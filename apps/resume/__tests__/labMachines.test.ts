import { describe, expect, it } from 'vitest'
import { createActor, type AnyStateMachine } from 'xstate'

import {
  corridorMachine,
  isTeleporting,
} from '@/lib/lab/domain/machines/corridor.machine'
import { roomMachine } from '@/lib/lab/domain/machines/room.machine'
import { canBrowse, dockMachine, hasSelection } from '@/lib/lab/domain/machines/dock.machine'

/**
 * 三台状态机的测试（ADR 20260903140616）。
 *
 * `roomMachine` 的部分已搬到 `roomMachineFlow.test.ts`（见下方注释）。
 *
 * 核心是最后一组：**每个可达状态都必须至少被一条生成路径走到**。
 * 这条断言是引入 XState 的主要理由——审计里两个「只能刷新页面」级别的故障
 * （B1 传送失败卡死、A8 进房报错静默）都是**漏了一条状态转移**，而手写
 * reducer 时没有任何东西能告诉你还缺什么，只能靠人工推演。
 *
 * 变异测试：注释掉 `corridor.machine.ts` 里 `enteringFast` 的 `ROOM_FAILED`
 * 那条边，「aborted 可达」会红。
 */

/*
  `roomMachine` 的行为测试**不在这个文件**，在
  `__tests__/roomMachineFlow.test.ts`。

  接线之后（ADR 20260903211338）那台机器成了运行时唯一的房间生命周期来源，
  测试也跟着升级成 `@xstate/graph` 的全路径覆盖——"每个状态可达 / 每条简单路径
  真能跑完 / 每个状态都有出边"，而不是手写几条 happy path。这里原先那三组
  describe 是它的真子集，留着只会让两处断言各自漂移。

  这个文件现在管 `corridorMachine`（**仍未接线**，运行时零引用）与
  `dockMachine`（Projects 在用），外加文件末尾对三台机器共用的静态分析。
*/

// ─── corridorMachine ─────────────────────────────────────────────────────────

function corridorActor() {
  const actor = createActor(corridorMachine)
  actor.start()
  actor.send({ type: 'LOADED' })
  return actor
}

function phaseOf(actor: { getSnapshot: () => { value: unknown } }): string {
  return String(actor.getSnapshot().value)
}

describe('corridorMachine', () => {
  it('点门进房、退房回走廊', () => {
    const a = corridorActor()
    expect(a.getSnapshot().value).toBe('corridor')

    a.send({ type: 'DOOR_CLICK', roomId: 'about', segmentIndex: 0 })
    expect(a.getSnapshot().value).toBe('entering')
    a.send({ type: 'ROOM_ENTERED', roomId: 'about' })
    expect(a.getSnapshot().value).toBe('inRoom')
    expect(a.getSnapshot().context.currentRoom).toBe('about')

    a.send({ type: 'EXIT' })
    a.send({ type: 'ROOM_EXITED' })
    expect(a.getSnapshot().value).toBe('corridor')
    expect(a.getSnapshot().context.currentRoom).toBeNull()
  })

  it('点门后加载失败回走廊', () => {
    const a = corridorActor()
    a.send({ type: 'DOOR_CLICK', roomId: 'projects', segmentIndex: 0 })
    a.send({ type: 'ROOM_FAILED' })
    expect(a.getSnapshot().value).toBe('corridor')
  })

  it('传送成功：合纸 → 瞬移 → 快速进房 → 撕纸', () => {
    const a = corridorActor()
    a.send({ type: 'TELEPORT', roomId: 'contact' })
    expect(a.getSnapshot().value).toEqual({ teleporting: 'paperClosing' })
    expect(isTeleporting(a.getSnapshot().value)).toBe(true)
    expect(a.getSnapshot().context.teleportTarget).toBe('contact')

    a.send({ type: 'PAPER_CLOSED' })
    expect(a.getSnapshot().value).toEqual({ teleporting: 'relocating' })
    a.send({ type: 'CAMERA_PLACED' })
    expect(a.getSnapshot().value).toEqual({ teleporting: 'enteringFast' })
    a.send({ type: 'ROOM_ENTERED', roomId: 'contact' })
    expect(a.getSnapshot().value).toEqual({ teleporting: 'paperOpening' })

    a.send({ type: 'PAPER_OPENED' })
    expect(a.getSnapshot().value).toBe('inRoom')
    expect(a.getSnapshot().context.currentRoom).toBe('contact')
    expect(a.getSnapshot().context.teleportTarget).toBeNull()
    expect(isTeleporting(a.getSnapshot().value)).toBe(false)
  })

  it('**传送中房间加载失败 → 纸打开、回走廊**（审计 B1：原先只能刷新）', () => {
    const a = corridorActor()
    a.send({ type: 'TELEPORT', roomId: 'projects' })
    a.send({ type: 'PAPER_CLOSED' })
    a.send({ type: 'CAMERA_PLACED' })
    a.send({ type: 'ROOM_FAILED' })

    expect(a.getSnapshot().value).toEqual({ teleporting: 'aborted' })

    // 关键：纸必须还能打开。原实现里这一步没有任何事件能触发，
    // 于是纸永久遮屏、错误卡在纸下面、导航全禁用。
    a.send({ type: 'PAPER_OPENED' })
    expect(a.getSnapshot().value).toBe('corridor')
    expect(a.getSnapshot().context.teleportTarget).toBeNull()
    expect(a.getSnapshot().context.currentRoom).toBeNull()
    expect(isTeleporting(a.getSnapshot().value)).toBe(false)
  })

  it('失败取消后还能再次传送 —— 状态没被卡住', () => {
    const a = corridorActor()
    a.send({ type: 'TELEPORT', roomId: 'projects' })
    a.send({ type: 'PAPER_CLOSED' })
    a.send({ type: 'CAMERA_PLACED' })
    a.send({ type: 'ROOM_FAILED' })
    a.send({ type: 'PAPER_OPENED' })

    a.send({ type: 'TELEPORT', roomId: 'about' })
    expect(isTeleporting(a.getSnapshot().value)).toBe(true)
    expect(a.getSnapshot().context.teleportTarget).toBe('about')
  })

  it('房间内可以直接传送到另一个房间', () => {
    const a = corridorActor()
    a.send({ type: 'DOOR_CLICK', roomId: 'about', segmentIndex: 0 })
    a.send({ type: 'ROOM_ENTERED', roomId: 'about' })
    a.send({ type: 'TELEPORT', roomId: 'contact' })
    expect(isTeleporting(a.getSnapshot().value)).toBe(true)
  })

  it('传送到当前所在房间被守卫拒绝', () => {
    const a = corridorActor()
    a.send({ type: 'DOOR_CLICK', roomId: 'about', segmentIndex: 0 })
    a.send({ type: 'ROOM_ENTERED', roomId: 'about' })
    a.send({ type: 'TELEPORT', roomId: 'about' })
    expect(a.getSnapshot().value).toBe('inRoom')
  })

  it('加载完成前不响应点门', () => {
    const a = createActor(corridorMachine)
    a.start()
    expect(a.getSnapshot().value).toBe('loading')
    a.send({ type: 'DOOR_CLICK', roomId: 'about', segmentIndex: 0 })
    expect(a.getSnapshot().value).toBe('loading')
  })
})

// ─── dockMachine ─────────────────────────────────────────────────────────────

describe('dockMachine', () => {
  function dockActor() {
    const actor = createActor(dockMachine)
    actor.start()
    return actor
  }

  it('选中 → 居中 → 停靠 → 收回', () => {
    const a = dockActor()
    expect(a.getSnapshot().value).toBe('browsing')

    a.send({ type: 'SELECT', id: 'p1' })
    expect(a.getSnapshot().value).toBe('centering')
    expect(a.getSnapshot().context.selectedId).toBe('p1')

    a.send({ type: 'CENTERED' })
    expect(a.getSnapshot().value).toBe('docking')
    a.send({ type: 'DOCKED' })
    expect(a.getSnapshot().value).toBe('docked')

    a.send({ type: 'DISMISS' })
    expect(a.getSnapshot().value).toBe('undocking')
    a.send({ type: 'UNDOCKED' })
    expect(a.getSnapshot().value).toBe('browsing')
    expect(a.getSnapshot().context.selectedId).toBeNull()
  })

  it('停靠中点另一个：先收回当前的，再居中新的', () => {
    const a = dockActor()
    a.send({ type: 'SELECT', id: 'p1' })
    a.send({ type: 'CENTERED' })
    a.send({ type: 'DOCKED' })

    a.send({ type: 'SELECT', id: 'p2' })
    expect(a.getSnapshot().value).toBe('undocking')
    expect(a.getSnapshot().context.pendingId).toBe('p2')

    a.send({ type: 'UNDOCKED' })
    expect(a.getSnapshot().value).toBe('centering')
    expect(a.getSnapshot().context.selectedId).toBe('p2')
    expect(a.getSnapshot().context.pendingId).toBeNull()
  })

  it('停靠中点当前那个 = 收回，不排队', () => {
    const a = dockActor()
    a.send({ type: 'SELECT', id: 'p1' })
    a.send({ type: 'CENTERED' })
    a.send({ type: 'DOCKED' })

    a.send({ type: 'SELECT', id: 'p1' })
    expect(a.getSnapshot().context.pendingId).toBeNull()
    a.send({ type: 'UNDOCKED' })
    expect(a.getSnapshot().value).toBe('browsing')
  })

  it('任意阶段 CANCEL 都回 browsing 并清空 —— 退房 / 传送要用', () => {
    for (const drive of [
      (a: ReturnType<typeof dockActor>) => a.send({ type: 'SELECT', id: 'x' }),
      (a: ReturnType<typeof dockActor>) => {
        a.send({ type: 'SELECT', id: 'x' })
        a.send({ type: 'CENTERED' })
      },
      (a: ReturnType<typeof dockActor>) => {
        a.send({ type: 'SELECT', id: 'x' })
        a.send({ type: 'CENTERED' })
        a.send({ type: 'DOCKED' })
      },
      (a: ReturnType<typeof dockActor>) => {
        a.send({ type: 'SELECT', id: 'x' })
        a.send({ type: 'CENTERED' })
        a.send({ type: 'DOCKED' })
        a.send({ type: 'DISMISS' })
      },
    ]) {
      const a = dockActor()
      drive(a)
      a.send({ type: 'CANCEL' })
      expect(a.getSnapshot().value).toBe('browsing')
      expect(a.getSnapshot().context).toEqual({ selectedId: null, pendingId: null })
    }
  })

  it('浏览判定：只有 browsing 能转盘', () => {
    expect(canBrowse('browsing')).toBe(true)
    expect(['centering', 'docking', 'docked', 'undocking'].some(canBrowse)).toBe(false)
    expect(['centering', 'docking', 'docked', 'undocking'].every(hasSelection)).toBe(true)
    expect(hasSelection('browsing')).toBe(false)
  })
})

// ─── 状态图的静态分析 ─────────────────────────────────────────────────────────

/**
 * 对机器**定义**做图分析，不执行状态机。
 *
 * 一开始用的是 `@xstate/graph` 的 `getShortestPaths`，喂 27 个事件 ——
 * **worker 直接 OOM 崩了**（116 秒后 "Worker exited unexpectedly"）：
 * `roomMachine` 的 `after: { 8000 }` 会被当成一个 `xstate.after(...)` 事件，
 * 与其余事件组合后路径数爆炸。
 *
 * 换成静态分析后，答案同样确定，代价是常数级。上面那些 actor 驱动的用例
 * 才是行为回归的正主；这里补的是「有没有状态到不了 / 出不去」这一类只能
 * 从图结构看出来的问题。
 */
interface StateNode {
  id: string
  /** 该状态能去的目标（同层用 key，跨层用 #id 绝对路径） */
  targets: string[]
  isFinal: boolean
}

function collectNodes(config: Record<string, unknown>, prefix = ''): StateNode[] {
  const states = (config.states ?? {}) as Record<string, Record<string, unknown>>
  const nodes: StateNode[] = []

  for (const [key, node] of Object.entries(states)) {
    const id = prefix ? `${prefix}.${key}` : key
    const children = (node.states ?? {}) as Record<string, unknown>
    const hasChildren = Object.keys(children).length > 0

    const targets: string[] = []
    const on = (node.on ?? {}) as Record<string, unknown>
    for (const handler of Object.values(on)) {
      for (const t of Array.isArray(handler) ? handler : [handler]) {
        const target = typeof t === 'string' ? t : (t as { target?: string }).target
        if (target) targets.push(target)
      }
    }
    // after / always 同样算出边
    for (const field of ['after', 'always'] as const) {
      const timed = (node[field] ?? {}) as Record<string, unknown>
      for (const handler of Object.values(timed)) {
        for (const t of Array.isArray(handler) ? handler : [handler]) {
          const target = typeof t === 'string' ? t : (t as { target?: string }).target
          if (target) targets.push(target)
        }
      }
    }

    if (!hasChildren) {
      nodes.push({ id, targets, isFinal: node.type === 'final' })
    } else {
      nodes.push(...collectNodes(node, id))
    }
  }
  return nodes
}

/** 把同层 key / #机器id.路径 归一成绝对路径 */
function normalizeTarget(machineId: string, fromId: string, target: string): string {
  if (target.startsWith('#')) {
    const withoutHash = target.slice(1)
    return withoutHash.startsWith(`${machineId}.`)
      ? withoutHash.slice(machineId.length + 1)
      : withoutHash
  }
  const parent = fromId.includes('.') ? fromId.slice(0, fromId.lastIndexOf('.')) : ''
  return parent ? `${parent}.${target}` : target
}

function analyze(machine: AnyStateMachine) {
  const config = machine.config as Record<string, unknown>
  const nodes = collectNodes(config)
  const byId = new Map(nodes.map(n => [n.id, n]))
  const machineId = String(config.id ?? machine.id)

  const edges = new Map<string, string[]>()
  for (const node of nodes) {
    edges.set(
      node.id,
      node.targets.map(t => normalizeTarget(machineId, node.id, t)),
    )
  }

  // 初始叶子状态
  let initialId = String(config.initial)
  let cursor = ((config.states as Record<string, Record<string, unknown>>)[initialId])
  while (cursor && cursor.states && Object.keys(cursor.states).length > 0) {
    const childKey = String(cursor.initial)
    initialId = `${initialId}.${childKey}`
    cursor = (cursor.states as Record<string, Record<string, unknown>>)[childKey]
  }

  // BFS 可达性
  const reachable = new Set<string>()
  const queue = [initialId]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const next of edges.get(id) ?? []) {
      // 跨层目标可能指向一个复合状态，展开到它的初始叶子
      const resolved = byId.has(next)
        ? next
        : nodes.find(n => n.id.startsWith(`${next}.`))?.id
      if (resolved && !reachable.has(resolved)) queue.push(resolved)
    }
  }

  return { nodes, reachable, edges, initialId }
}

describe('状态图静态分析', () => {
  const machines: [string, AnyStateMachine, string[]][] = [
    ['roomMachine', roomMachine, ['idle']],
    ['corridorMachine', corridorMachine, ['corridor']],
    ['dockMachine', dockMachine, ['browsing']],
  ]

  it.each(machines)('%s 的每个状态都从初始态可达', (name, machine) => {
    const { nodes, reachable } = analyze(machine)
    expect(nodes.length, `${name} 没解析出状态，分析函数失效了`).toBeGreaterThan(3)

    const unreachable = nodes.filter(n => !reachable.has(n.id)).map(n => n.id)
    expect(unreachable, `${name} 有状态永远进不去：${unreachable.join(', ')}`).toEqual([])
  })

  it.each(machines)('%s 没有死胡同（非 final 状态必须有出边）', (name, machine) => {
    const { nodes, edges } = analyze(machine)
    const deadEnds = nodes
      .filter(n => !n.isFinal && (edges.get(n.id) ?? []).length === 0)
      .map(n => n.id)
    expect(deadEnds, `${name} 有状态出不去：${deadEnds.join(', ')}`).toEqual([])
  })

  it.each(machines)('%s 的每个状态都能回到静息态', (name, machine, restStates) => {
    const { nodes, edges } = analyze(machine)
    const rest = new Set(restStates)

    /** 从 id 出发能否到达任一静息态 */
    function canRest(start: string): boolean {
      const seen = new Set<string>()
      const queue = [start]
      while (queue.length > 0) {
        const id = queue.pop()!
        if (rest.has(id)) return true
        if (seen.has(id)) continue
        seen.add(id)
        for (const next of edges.get(id) ?? []) {
          const resolved = nodes.some(n => n.id === next)
            ? next
            : nodes.find(n => n.id.startsWith(`${next}.`))?.id
          if (resolved) queue.push(resolved)
        }
      }
      return false
    }

    const stuck = nodes.filter(n => !n.isFinal && !canRest(n.id)).map(n => n.id)
    expect(
      stuck,
      `${name} 有状态回不到静息态（用户会卡住，只能刷新）：${stuck.join(', ')}`,
    ).toEqual([])
  })

  it('corridorMachine 的 teleporting.aborted 存在且有出边 —— 审计 B1 的那条边', () => {
    const { nodes, edges } = analyze(corridorMachine)
    const aborted = nodes.find(n => n.id === 'teleporting.aborted')
    expect(aborted, 'teleporting.aborted 不存在 —— B1 的修法被删了').toBeDefined()
    expect(
      edges.get('teleporting.aborted') ?? [],
      'aborted 没有出边 → 纸永远不打开，用户只能刷新',
    ).not.toEqual([])
  })

  it('roomMachine 的 entered 能到 failed —— 审计 A8 的那条边', () => {
    const { edges } = analyze(roomMachine)
    expect(
      edges.get('entered') ?? [],
      'entered 无法进入 failed → 进房后报错时房间静默消失、无任何提示',
    ).toContain('failed')
  })

  it('分析函数本身能发现被摘掉的边 —— 变异测试', () => {
    // 人为构造一台缺出边的机器，确认上面的断言真的会红
    const broken = {
      id: 'broken',
      initial: 'a',
      states: {
        a: { on: { GO: 'trap' } },
        trap: {}, // 没有出边、也不是 final
      },
    }
    const { nodes, edges } = analyze({ config: broken, id: 'broken' } as never)
    const deadEnds = nodes.filter(n => !n.isFinal && (edges.get(n.id) ?? []).length === 0)
    expect(deadEnds.map(n => n.id)).toEqual(['trap'])
  })
})
