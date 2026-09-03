import { assign, setup } from 'xstate'

import type { RoomId } from '../ids'

/**
 * 走廊顶层状态图，含传送子状态（ADR 20260903140616）。
 *
 * 取代 `context/SceneContext.tsx` 里那五个互相约束的字段
 * （`teleportTarget` / `isTeleporting` / `teleportPhase` / `isFastTeleport` /
 * `pendingDoorClick`）。
 *
 * **它存在的首要理由是 `teleporting.aborted` 这一条边。**
 *
 * 审计 B1（实机复现过）：用地图传送到某房间，若该房间加载失败——
 *   - 合上的纸（PaperTransition，z-index 9998）永久遮住屏幕
 *   - 错误卡（z-index 30）在纸**下面**看不见
 *   - 导航因 `isTeleporting` 为 true 全部禁用
 *   - 用户只能刷新页面
 * 根因是 `cancelTeleport` **零调用方**：失败路径上没有任何地方重置那五个字段。
 *
 * 在扁平的布尔集合里，这个缺口看不出来；在状态图里，`entering_fast` 只有
 * 通往 `paperOpening` 的一条出边这件事**一眼就是错的**。止血批已经给旧实现
 * 打了补丁（`resetRoomLoad` 里调 `cancelTeleport`），本机器让它在结构上
 * 不可能再发生。
 */

export interface CorridorContext {
  /** 当前所在房间；null = 在走廊里 */
  currentRoom: RoomId | null
  /** 传送目标 */
  teleportTarget: RoomId | null
  /** 传送时跳过房间进入动画（纸已经遮住了，动画看不见） */
  fastTeleport: boolean
}

export type CorridorEvent =
  | { type: 'LOADED' }
  | { type: 'DOOR_CLICK'; roomId: RoomId; segmentIndex: number }
  | { type: 'ROOM_ENTERED'; roomId: RoomId }
  | { type: 'ROOM_FAILED' }
  | { type: 'ROOM_EXITED' }
  | { type: 'EXIT' }
  | { type: 'TELEPORT'; roomId: RoomId }
  | { type: 'PAPER_CLOSED' }
  | { type: 'CAMERA_PLACED' }
  | { type: 'PAPER_OPENED' }

export const corridorMachine = setup({
  types: {
    context: {} as CorridorContext,
    events: {} as CorridorEvent,
  },
  actions: {
    setTeleportTarget: assign(({ event }) => {
      if (event.type !== 'TELEPORT') return {}
      return { teleportTarget: event.roomId, fastTeleport: true }
    }),
    enterRoom: assign(({ event }) => {
      if (event.type !== 'ROOM_ENTERED') return {}
      return { currentRoom: event.roomId }
    }),
    leaveRoom: assign(() => ({ currentRoom: null })),
    clearTeleport: assign(() => ({ teleportTarget: null, fastTeleport: false })),
    /** 传送成功：目标房间成为当前房间，同时清掉传送状态 */
    commitTeleport: assign(({ context }) => ({
      currentRoom: context.teleportTarget,
      teleportTarget: null,
      fastTeleport: false,
    })),
  },
  guards: {
    /** 传送到当前已在的房间没有意义 */
    isDifferentRoom: ({ context, event }) =>
      event.type === 'TELEPORT' && event.roomId !== context.currentRoom,
  },
}).createMachine({
  id: 'corridor',
  initial: 'loading',
  context: { currentRoom: null, teleportTarget: null, fastTeleport: false },
  states: {
    /** 首屏纹理加载（撕纸 loader 覆盖期间） */
    loading: {
      on: { LOADED: 'corridor' },
    },

    corridor: {
      on: {
        DOOR_CLICK: 'entering',
        TELEPORT: { target: 'teleporting', guard: 'isDifferentRoom', actions: 'setTeleportTarget' },
      },
    },

    /** 点门后：相机对齐 → 房间加载 → 开门 → 飞入。细节在 roomMachine 里 */
    entering: {
      on: {
        ROOM_ENTERED: { target: 'inRoom', actions: 'enterRoom' },
        // 加载失败时用户点「Back to corridor」，房间机器回 idle，这里跟着回走廊
        ROOM_FAILED: 'corridor',
      },
    },

    inRoom: {
      on: {
        EXIT: 'exiting',
        TELEPORT: { target: 'teleporting', guard: 'isDifferentRoom', actions: 'setTeleportTarget' },
      },
    },

    exiting: {
      on: { ROOM_EXITED: { target: 'corridor', actions: 'leaveRoom' } },
    },

    teleporting: {
      initial: 'paperClosing',
      states: {
        /** 纸从两侧飞来合上 */
        paperClosing: {
          on: { PAPER_CLOSED: 'relocating' },
        },
        /** 纸后面瞬移相机到目标门前 */
        relocating: {
          on: { CAMERA_PLACED: 'enteringFast' },
        },
        /** 快速进房（纸还遮着，进入动画跳过） */
        enteringFast: {
          on: {
            ROOM_ENTERED: 'paperOpening',
            /**
             * **审计 B1 的修法。**
             * 这条边原先不存在——房间加载失败时纸永远不打开、导航永远禁用，
             * 用户只能刷新。在扁平的布尔集合里看不出缺口；在这里，
             * `enteringFast` 只有一条出边这件事一眼就是错的。
             */
            ROOM_FAILED: 'aborted',
          },
        },
        /** 纸撕开，露出新房间 */
        paperOpening: {
          on: {
            // 用绝对 id 直接跳到父层的兄弟状态。
            // 不能把 PAPER_OPENED 同时挂在子状态和父状态上——XState 里子状态
            // 处理了事件父状态那份就不会触发，父层的收尾逻辑会成为死代码。
            PAPER_OPENED: { target: '#corridor.inRoom', actions: 'commitTeleport' },
          },
        },
        /** 失败也要把纸打开，把用户还给走廊 */
        aborted: {
          on: {
            PAPER_OPENED: { target: '#corridor.corridor', actions: ['clearTeleport', 'leaveRoom'] },
          },
        },
      },
    },
  },
})

/** 传送中（导航该禁用、纸该显示） */
export function isTeleporting(stateValue: unknown): boolean {
  return typeof stateValue === 'object' && stateValue !== null && 'teleporting' in stateValue
}
