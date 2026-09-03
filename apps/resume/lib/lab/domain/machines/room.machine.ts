import { assign, setup } from 'xstate'

import type { RoomId } from '../ids'

/**
 * 房间生命周期状态图（ADR 20260903140616）。
 *
 * 取代 `lib/lab/roomLoadMachine.ts` + `lib/lab/doorEntryFlow.ts` +
 * `components/lab/useDoorEntryOrchestrator.ts` 三件套。原实现本身写得不差，
 * 缺的是**穷举与验证**能力：
 *
 * - 非法转移靠 `throw`，调用方 `try/catch` 翻译成 `null` → 于是「非法转移」
 *   与「守卫拒绝」在调用点无法区分
 * - 8 秒加载超时是手写 `setTimeout` + 三个 ref（loadTimeout / openingAttempt /
 *   ownedEntry）互相看护，`useDoorEntryOrchestrator` 有 5 个 effect 专门维护
 *   这套 ref 的一致性
 * - **`entered` 之后发生运行时错误没有出口**：`RoomErrorBoundary` 渲染 null、
 *   房间消失，但状态仍是 `entered`，没有任何提示（审计 A8）——因为
 *   `handleRoomError` 只在 loading 阶段派发
 *
 * XState 把这三件都变成声明：`after` 表达超时，`onError` 与显式边表达失败，
 * `@xstate/graph` 从定义生成覆盖所有转移的测试路径——**漏一条边就会有一条
 * 没被覆盖的路径**，而不是等它在线上表现为「只能刷新」。
 */

export const ROOM_LOAD_TIMEOUT_MS = 8000

export interface RoomContext {
  roomId: RoomId | null
  segmentIndex: number | null
  /** 重试次数。用作 React key，让房间子树在重试时彻底重挂 */
  attempt: number
  error: string | null
}

export type RoomEvent =
  | { type: 'BEGIN'; roomId: RoomId; segmentIndex: number }
  | { type: 'CAMERA_ALIGNED' }
  | { type: 'MOUNTED' }
  | { type: 'READY' }
  | { type: 'DOOR_OPENED' }
  | { type: 'RUNTIME_ERROR'; message: string }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'EXIT' }
  | { type: 'EXIT_DONE' }
  /**
   * 放弃当前这次进房，无条件回到 idle（从失败退出、退场收尾）。
   *
   * 原先还有一个 `BACK`，目标与动作和 `RESET` **逐字相同**，而运行时没有任何
   * 地方发它——4 条边全是死的。`__tests__/machineEventWiring.test.ts` 抓出来后
   * 删掉：两个名字表达同一件事只会让下一个人猜该发哪一个。
   */
  | { type: 'RESET' }
  /** 传送开始：无动画地把房间收回 idle，不播退场 */
  | { type: 'TELEPORT_RESET' }

export const roomMachine = setup({
  types: {
    context: {} as RoomContext,
    events: {} as RoomEvent,
  },
  actions: {
    begin: assign(({ event }) => {
      if (event.type !== 'BEGIN') return {}
      return {
        roomId: event.roomId,
        segmentIndex: event.segmentIndex,
        attempt: 1,
        error: null,
      }
    }),
    recordError: assign(({ event }) => {
      if (event.type !== 'RUNTIME_ERROR' && event.type !== 'LOAD_ERROR') return {}
      return { error: event.message }
    }),
    countRetry: assign(({ context }) => ({
      attempt: context.attempt + 1,
      error: null,
    })),
    clear: assign(() => ({
      roomId: null,
      segmentIndex: null,
      attempt: 0,
      error: null,
    })),
  },
}).createMachine({
  id: 'room',
  initial: 'idle',
  context: { roomId: null, segmentIndex: null, attempt: 0, error: null },
  states: {
    idle: {
      on: { BEGIN: { target: 'aligning', actions: 'begin' } },
    },

    /** 相机正飞向门前的对齐位姿 */
    aligning: {
      on: {
        CAMERA_ALIGNED: 'mounting',
        RESET: { target: 'idle', actions: 'clear' },
      },
    },

    /** 房间子树已挂载，正在等纹理 */
    mounting: {
      on: {
        MOUNTED: 'loading',
        /*
          直接就绪：纹理**已在缓存里**时房间不会 Suspend，于是没有 `MOUNTED`
          （那个事件的来源是 Suspense fallback 挂载）。少了这条边，缓存命中的
          房间会永久卡在 `mounting`——门开不了、加载卡也不显示，只能刷新。

          接线时才发现这个缺口：机器写好了但从未接入运行时，所以「缓存命中」
          这条最常见的路径（第二次进同一间房）从来没被走过。
        */
        READY: 'ready',
        LOAD_ERROR: { target: 'failed', actions: 'recordError' },
        RESET: { target: 'idle', actions: 'clear' },
      },
    },

    loading: {
      // 手写 setTimeout + 三个互相看护的 ref 变成这一行
      after: {
        [ROOM_LOAD_TIMEOUT_MS]: {
          target: 'failed',
          actions: assign({ error: 'Room loading timed out' }),
        },
      },
      on: {
        READY: 'ready',
        LOAD_ERROR: { target: 'failed', actions: 'recordError' },
        RESET: { target: 'idle', actions: 'clear' },
      },
    },

    /** 纹理就位，等门板开完 */
    ready: {
      on: {
        DOOR_OPENED: 'entered',
        LOAD_ERROR: { target: 'failed', actions: 'recordError' },
        RESET: { target: 'idle', actions: 'clear' },
      },
    },

    entered: {
      on: {
        EXIT: 'exiting',
        // 审计 A8 的修法：进房后报错原先没有任何出口，房间静默消失
        RUNTIME_ERROR: { target: 'failed', actions: 'recordError' },
        TELEPORT_RESET: { target: 'idle', actions: 'clear' },
      },
    },

    failed: {
      on: {
        RETRY: { target: 'loading', actions: 'countRetry' },
        RESET: { target: 'idle', actions: 'clear' },
      },
    },

    exiting: {
      on: {
        EXIT_DONE: { target: 'idle', actions: 'clear' },
        /*
          `RESET` 与 `EXIT_DONE` 都回到 idle，保留两个是因为语义不同：
          前者是"放弃"（从失败里退出），后者是"退场动画跑完了"。运行时
          `resetRoomLoad()` 一个函数服务两种场景（旧 reducer 也是
          `exiting | failed --RESET--> idle`），所以两个状态都要接 `RESET`。
        */
        RESET: { target: 'idle', actions: 'clear' },
      },
    },
  },
})

export type RoomPhase = keyof typeof roomMachine.states | 'idle'

/** 加载中（该显示 loading 卡） */
export function isRoomLoading(phase: string): boolean {
  return phase === 'aligning' || phase === 'mounting' || phase === 'loading'
}

/**
 * 走廊此刻是不是"闲着"，可以弹教程 / 提示。
 *
 * 审计 D5：`LabTutorial` 原先只检查 `isInRoom` 与 `isTeleporting`。用户点了门之后
 * 相位是 `aligning` / `mounting` / `loading` / `ready`——**还没进房**，所以
 * `isInRoom` 仍是 false，2.4 秒的延迟一到教程就盖在开门动画上。
 *
 * 判断"能不能打扰用户"不该靠列举几个布尔量，而该问一句"走廊现在是不是空闲"。
 */
export function isCorridorIdle(phase: string): boolean {
  return phase === 'idle'
}

/**
 * 这扇门是不是这次进房的**所有者**。
 *
 * 15 段走廊各有自己的 `DoorSection` 实例，共享一台状态机——只有点了的那一扇
 * 该响应后续的编排。判据从机器的 context 派生（`roomId` + `segmentIndex`），
 * **不是靠组件里的 ref 记账**：旧实现用 `ownedEntryRef` + `previousPhaseRef`
 * 互相看护，而它们要靠"观察到 failed → idle 这次转移"来复位，中间插进一次
 * 别的渲染就永久卡住（E2E 抓到的表现是"从失败退出后再也传送不了"）。
 */
export function isDoorEntryOwner(
  context: Pick<RoomContext, 'roomId' | 'segmentIndex'>,
  phase: string,
  roomId: RoomId,
  segmentIndex: number,
): boolean {
  return phase !== 'idle' && context.roomId === roomId && context.segmentIndex === segmentIndex
}

/** 房间子树该挂载了吗（相机对齐之后就挂，让纹理开始加载） */
export function shouldMountRoom(phase: string): boolean {
  return phase === 'mounting' || phase === 'loading' || phase === 'ready'
    || phase === 'entered' || phase === 'exiting'
}
