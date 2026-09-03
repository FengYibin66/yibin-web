import { afterEach, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { getShortestPaths, getSimplePaths } from '@xstate/graph'

import {
  ROOM_LOAD_TIMEOUT_MS,
  isCorridorIdle,
  isDoorEntryOwner,
  isRoomLoading,
  roomMachine,
  shouldMountRoom,
  type RoomEvent,
} from '@/lib/lab/domain/machines/room.machine'

/**
 * 房间生命周期状态图的行为与**全路径覆盖**（ADR 20260903140616 / 20260903211338）。
 *
 * ## 这个文件取代了什么
 *
 * `__tests__/roomLoadMachine.test.ts`（10 条）与 `__tests__/doorEntryFlow.test.ts`
 * （8 条）测的是手写 reducer 三件套，那三个文件已随实现删除。它们断言的语义
 * 逐条搬到了这里——但**不是照抄**：原来那些是"逐个手写一条路径"，而状态图允许
 * 直接问「所有路径都覆盖到了吗」。
 *
 * ## `@xstate/graph`：ADR 616 承诺过但一直没兑现的那部分
 *
 * ADR 20260903140616 写的是「`@xstate/graph` 生成全路径测试」，而那个包装了却
 * 从未被任何测试引用（`grep @xstate/graph` 只命中 package.json）。它的价值不是
 * "多几条用例"，而是**把"漏了一条边"变成可发现的**：手写路径只能覆盖作者想到的
 * 组合，而这套接线过程中真的漏了一条——`mounting` 状态没有 `READY` 边，于是纹理
 * 已缓存的房间（第二次进同一间房，最常见的路径）会永久卡住。
 */

/**
 * 事件样本 —— `@xstate/graph` 需要具体事件（带载荷的那些它猜不出来）。
 *
 * 少一个事件类型，遍历就少覆盖它的所有边，而那正好是"看起来全覆盖了"的假象来源。
 * 下面有一条断言检查这张表与机器声明的事件类型一致。
 */
const EVENT_SAMPLES: Record<string, RoomEvent[]> = {
  BEGIN: [{ type: 'BEGIN', roomId: 'about', segmentIndex: 2 }],
  CAMERA_ALIGNED: [{ type: 'CAMERA_ALIGNED' }],
  MOUNTED: [{ type: 'MOUNTED' }],
  READY: [{ type: 'READY' }],
  DOOR_OPENED: [{ type: 'DOOR_OPENED' }],
  RUNTIME_ERROR: [{ type: 'RUNTIME_ERROR', message: 'boom' }],
  LOAD_ERROR: [{ type: 'LOAD_ERROR', message: 'texture 404' }],
  RETRY: [{ type: 'RETRY' }],
  EXIT: [{ type: 'EXIT' }],
  EXIT_DONE: [{ type: 'EXIT_DONE' }],
  RESET: [{ type: 'RESET' }],
  TELEPORT_RESET: [{ type: 'TELEPORT_RESET' }],
}

/** `@xstate/graph` v3 要的是一个平铺事件数组 */
const ALL_EVENTS: RoomEvent[] = Object.values(EVENT_SAMPLES).flat()

/**
 * 遍历时**只按状态名去重，不看 context**。
 *
 * 默认的序列化把 context 也算进"这个状态我走过了吗"，而 `attempt` 每次 `RETRY`
 * 都 +1——于是 `failed --RETRY--> loading` 每走一遍都是一个"新状态"，状态空间无限，
 * 遍历永不终止。第一版就是这么挂住的：测试不报错、不超时，vitest 进程直接不返回。
 *
 * 「覆盖所有转移」问的本来就是状态图的边，不是 context 的取值空间。
 */
const TRAVERSAL = {
  events: ALL_EVENTS,
  serializeState: (state: { value: unknown }) => String(state.value),
} as const

/*
  每个 actor 都要 stop。

  `loading` 状态有一个 8 秒的 `after`，actor 一进那个状态就挂上真实定时器；
  不 stop 的话几十个 actor 各自吊着一个 8 秒 timer，vitest 跑完测试仍不退出
  （表现是"测试全过但进程挂住"）。第一版就是这么挂的。
*/
const running: Array<{ stop: () => void }> = []

afterEach(() => {
  while (running.length) running.pop()!.stop()
})

function spawn() {
  const actor = createActor(roomMachine).start()
  running.push(actor)
  return actor
}

/** 用最短路径把机器开到指定状态 */
function drive(target: string) {
  const paths = getShortestPaths(roomMachine, {
    ...TRAVERSAL,
    toState: state => state.value === target,
  })
  expect(paths.length, `到不了 ${target}`).toBeGreaterThan(0)
  const actor = spawn()
  for (const step of paths[0]!.steps) actor.send(step.event)
  return actor
}

describe('全路径覆盖', () => {
  it('事件样本覆盖了机器声明的每一个外部事件', () => {
    /*
      这条防的是"看起来全覆盖了"：`getSimplePaths` 只会走它认识的事件，
      样本表里漏一个，那个事件的所有边就静默不被遍历。

      `xstate.*` 前缀的是机器自己生成的内部事件（`after` 的定时器），
      外部发不了也不该发——它们单独在下一条里断言。
    */
    const declared = roomMachine.events.filter(e => !e.startsWith('xstate.'))
    const sampled = new Set(Object.keys(EVENT_SAMPLES))
    const missing = declared.filter(e => !sampled.has(e))
    expect(missing, `EVENT_SAMPLES 缺这些事件：${missing.join(', ')}`).toEqual([])
  })

  it('加载超时那条边确实存在 —— 上一条把它排除了，这里正面认领', () => {
    const internal = roomMachine.events.filter(e => e.startsWith('xstate.'))
    expect(internal, '8 秒超时的定时器边不见了').toEqual([
      `xstate.after.${ROOM_LOAD_TIMEOUT_MS}.room.loading`,
    ])
  })

  it('每个状态都可达 —— 到不了的状态是死代码', () => {
    const states = Object.keys(roomMachine.states)
    const unreachable: string[] = []
    for (const state of states) {
      const paths = getShortestPaths(roomMachine, {
        ...TRAVERSAL,
        toState: s => s.value === state,
      })
      if (paths.length === 0) unreachable.push(state)
    }
    expect(unreachable, `这些状态从 idle 到不了：${unreachable.join(', ')}`).toEqual([])
  })

  it('每条简单路径都能真的跑完，不抛异常', () => {
    /*
      `getSimplePaths` 穷举所有不重复经过同一状态的路径。逐条真的跑一遍——
      action 里的 `assign` 若在某个状态组合下崩掉，只有真跑才发现。
    */
    const paths = getSimplePaths(roomMachine, TRAVERSAL)
    expect(paths.length, '一条路径都没生成，遍历配置有问题').toBeGreaterThan(10)

    for (const path of paths) {
      const actor = createActor(roomMachine).start()
      expect(() => {
        for (const step of path.steps) actor.send(step.event)
      }, `路径跑崩了：${path.steps.map(s => s.event.type).join(' → ')}`).not.toThrow()
      actor.stop()
    }
  })

  it('每个状态都有出边 —— 没有出边的状态是死胡同，用户只能刷新', () => {
    /*
      这条是审计 A8 那类问题的通用形态：`entered` 之后报错原先没有出口，
      房间静默消失而相位不变。「每个状态都能出去」是可以机械检查的。
    */
    for (const [name, state] of Object.entries(roomMachine.states)) {
      const hasTransitions = Object.keys(state.config.on ?? {}).length > 0
      const hasAfter = Object.keys(state.config.after ?? {}).length > 0
      expect(hasTransitions || hasAfter, `${name} 没有任何出边`).toBe(true)
    }
  })
})

describe('成功进房那条路', () => {
  it('idle → aligning → mounting → loading → ready → entered', () => {
    const actor = spawn()
    const seen: string[] = [actor.getSnapshot().value as string]

    for (const event of [
      { type: 'BEGIN', roomId: 'about', segmentIndex: 2 },
      { type: 'CAMERA_ALIGNED' },
      { type: 'MOUNTED' },
      { type: 'READY' },
      { type: 'DOOR_OPENED' },
    ] as RoomEvent[]) {
      actor.send(event)
      seen.push(actor.getSnapshot().value as string)
    }

    expect(seen).toEqual(['idle', 'aligning', 'mounting', 'loading', 'ready', 'entered'])
    expect(actor.getSnapshot().context).toMatchObject({
      roomId: 'about',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })
  })

  it('纹理已缓存时 mounting 直接到 ready —— 第二次进同一间房走这条', () => {
    /*
      **接线时才发现的缺口。** `MOUNTED` 的来源是 Suspense fallback 挂载，而纹理
      已在缓存里时房间根本不会 Suspend，于是那个事件永远不来。少了这条边，
      缓存命中的房间会永久卡在 `mounting`——门开不了、加载卡也不显示。

      机器写好但从未接入运行时，所以这条最常见的路径从来没被走过。
    */
    const actor = spawn()
    actor.send({ type: 'BEGIN', roomId: 'projects', segmentIndex: 0 })
    actor.send({ type: 'CAMERA_ALIGNED' })
    expect(actor.getSnapshot().value).toBe('mounting')

    actor.send({ type: 'READY' })
    expect(actor.getSnapshot().value, 'mounting 收到 READY 却没动 —— 缓存命中的房间会卡死')
      .toBe('ready')
  })

  it('重复 BEGIN 被忽略 —— 连点门不该重启流程', () => {
    const actor = spawn()
    actor.send({ type: 'BEGIN', roomId: 'about', segmentIndex: 1 })
    actor.send({ type: 'BEGIN', roomId: 'contact', segmentIndex: 5 })
    expect(actor.getSnapshot().context.roomId, '第二次点门把目标改掉了').toBe('about')
  })

  it('门没开完不算进房 —— ready 收到 READY 不动', () => {
    const actor = drive('ready')
    const before = actor.getSnapshot().value
    actor.send({ type: 'READY' })
    expect(actor.getSnapshot().value).toBe(before)
  })
})

describe('加载超时', () => {
  it('loading 里 8 秒不 READY 就 failed —— 一行 after 取代手写 setTimeout', () => {
    /*
      旧实现是 `useDoorEntryOrchestrator` 里一个 `setTimeout` 加 `loadTimeoutRef`，
      外加两个 ref 看着它别在错误的时刻触发（5 个 effect 维护这套一致性）。
    */
    expect(ROOM_LOAD_TIMEOUT_MS).toBe(8000)
    const config = roomMachine.states.loading.config.after
    expect(config, 'loading 没有超时边').toBeDefined()
    expect(Object.keys(config!)).toContain(String(ROOM_LOAD_TIMEOUT_MS))
  })

  it('ready 之后不再超时 —— 纹理已就位，等的是门板动画', () => {
    expect(roomMachine.states.ready.config.after ?? {}).toEqual({})
    expect(roomMachine.states.entered.config.after ?? {}).toEqual({})
  })
})

describe('失败与恢复', () => {
  it('重试保留房间并累加 attempt —— attempt 是房间子树的 React key', () => {
    const actor = drive('failed')
    const before = actor.getSnapshot().context

    actor.send({ type: 'RETRY' })
    const after = actor.getSnapshot()

    expect(after.value).toBe('loading')
    expect(after.context.roomId, '重试把房间弄丢了').toBe(before.roomId)
    expect(after.context.attempt).toBe(before.attempt + 1)
    expect(after.context.error, '重试没清掉上一次的错误').toBeNull()
  })

  it('从失败回到走廊会清空 context —— 留着旧 roomId 会让下一次进房认错门', () => {
    const actor = drive('failed')
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context).toEqual({
      roomId: null,
      segmentIndex: null,
      attempt: 0,
      error: null,
    })
  })

  it('entered 之后的运行时错误有出口 —— 这是审计 A8', () => {
    /*
      旧实现里 `handleRoomError` 只在 loading 阶段派发，于是 `entered` 之后报错
      被直接丢掉：`RoomErrorBoundary` 渲染 null、房间消失，而相位仍是 `entered`
      ——没有提示、没有重试、只能刷新。
    */
    const actor = drive('entered')
    actor.send({ type: 'RUNTIME_ERROR', message: 'shader compile failed' })
    expect(actor.getSnapshot().value, 'entered 报错之后没有出口').toBe('failed')
    expect(actor.getSnapshot().context.error).toBe('shader compile failed')
  })

  it('失败信息被记下来，供 UI 显示', () => {
    const actor = drive('loading')
    actor.send({ type: 'LOAD_ERROR', message: 'room-load-timeout' })
    expect(actor.getSnapshot().context.error).toBe('room-load-timeout')
  })
})

describe('退场与传送', () => {
  it('entered → exiting → idle', () => {
    const actor = drive('entered')
    actor.send({ type: 'EXIT' })
    expect(actor.getSnapshot().value).toBe('exiting')
    actor.send({ type: 'EXIT_DONE' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('传送从 entered 无动画地回到 idle', () => {
    const actor = drive('entered')
    actor.send({ type: 'TELEPORT_RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.roomId).toBeNull()
  })

  it('退场中的过期回调不再生效 —— exiting 不接 EXIT', () => {
    const actor = drive('entered')
    actor.send({ type: 'EXIT' })
    actor.send({ type: 'EXIT' })
    expect(actor.getSnapshot().value).toBe('exiting')
  })

  it('exiting 也接 RESET —— 一个 resetRoomLoad 服务"放弃"与"退场收尾"两种场景', () => {
    const actor = drive('entered')
    actor.send({ type: 'EXIT' })
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe('idle')
  })
})

describe('派生判据', () => {
  it('isCorridorIdle 只在 idle 为真 —— 点了门之后不该弹教程（审计 D5）', () => {
    expect(isCorridorIdle('idle')).toBe(true)
    for (const phase of ['aligning', 'mounting', 'loading', 'ready', 'entered']) {
      expect(isCorridorIdle(phase), `${phase} 被当成了空闲`).toBe(false)
    }
  })

  it('isRoomLoading 覆盖三个"还在等"的相位', () => {
    for (const phase of ['aligning', 'mounting', 'loading']) {
      expect(isRoomLoading(phase), phase).toBe(true)
    }
    for (const phase of ['idle', 'ready', 'entered', 'failed', 'exiting']) {
      expect(isRoomLoading(phase), phase).toBe(false)
    }
  })

  it('shouldMountRoom 从 mounting 起为真 —— 挂载要早于纹理加载', () => {
    expect(shouldMountRoom('aligning')).toBe(false)
    for (const phase of ['mounting', 'loading', 'ready', 'entered', 'exiting']) {
      expect(shouldMountRoom(phase), phase).toBe(true)
    }
  })

  it('isDoorEntryOwner 按 roomId + segmentIndex 认门', () => {
    const context = { roomId: 'about' as const, segmentIndex: 3 }
    expect(isDoorEntryOwner(context, 'loading', 'about', 3)).toBe(true)
    expect(isDoorEntryOwner(context, 'loading', 'about', 4), '认错了段').toBe(false)
    expect(isDoorEntryOwner(context, 'loading', 'contact', 3), '认错了房间').toBe(false)
  })

  it('idle 时没有门是所有者 —— 否则空闲状态下的门会响应编排', () => {
    const context = { roomId: 'about' as const, segmentIndex: 3 }
    expect(isDoorEntryOwner(context, 'idle', 'about', 3)).toBe(false)
  })
})
