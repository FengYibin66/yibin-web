import { assign, setup } from 'xstate'

/**
 * 「浏览 → 居中 → 停靠 → 收回」状态图，Projects 与 Publications 共用
 * （ADR 20260903140616）。
 *
 * 取代 `components/rooms/publications/publicationMotionMachine.ts`。那台机器
 * 的相位（hanging / centering / detaching / flipping / open / returning）是
 * Publications 的特例——它的「停靠」带一段翻转动画。抽出共用机器的目的是让
 * 两个房间的 hover / 点击 / ESC / 手势语义**一致**：现在 Projects 是
 * 「无限下落 + 点击直接 window.open」，Publications 是「转盘吸附 + 停靠展开」，
 * 同一个动作在两个房间里含义不同。
 *
 * `pendingId` 是「停靠中又点了另一个」这条路径：先收回当前的，再居中新的。
 * 原实现有这一条，但它在 `transitionFromOpen` / `transitionFromReturning`
 * 两个函数里用 `pendingId === null` 的分支表达，读起来要在两处之间跳。
 */

export interface DockContext {
  /** 当前停靠的条目 */
  selectedId: string | null
  /** 收回过程中排队的下一个 */
  pendingId: string | null
}

export type DockEvent =
  | { type: 'SELECT'; id: string }
  | { type: 'CENTERED' }
  | { type: 'DOCKED' }
  | { type: 'DISMISS' }
  | { type: 'UNDOCKED' }
  | { type: 'CANCEL' }

export const dockMachine = setup({
  types: {
    context: {} as DockContext,
    events: {} as DockEvent,
  },
  actions: {
    select: assign(({ event }) => {
      if (event.type !== 'SELECT') return {}
      return { selectedId: event.id, pendingId: null }
    }),
    /** 停靠中又点了别的：记下来，先收回当前的 */
    queueNext: assign(({ context, event }) => {
      if (event.type !== 'SELECT') return {}
      return { pendingId: event.id === context.selectedId ? null : event.id }
    }),
    promotePending: assign(({ context }) => ({
      selectedId: context.pendingId,
      pendingId: null,
    })),
    clear: assign(() => ({ selectedId: null, pendingId: null })),
  },
  guards: {
    hasPending: ({ context }) => context.pendingId !== null,
  },
}).createMachine({
  id: 'dock',
  initial: 'browsing',
  context: { selectedId: null, pendingId: null },
  states: {
    /** 可自由转动/滚动浏览 */
    browsing: {
      on: {
        SELECT: { target: 'centering', actions: 'select' },
      },
    },

    /** 转盘正把选中项转到正面 */
    centering: {
      on: {
        CENTERED: 'docking',
        CANCEL: { target: 'browsing', actions: 'clear' },
      },
    },

    /** 选中项正飞向相机（Publications 在这一段做翻转） */
    docking: {
      on: {
        DOCKED: 'docked',
        CANCEL: { target: 'browsing', actions: 'clear' },
      },
    },

    /** 停靠完成，详情可读 */
    docked: {
      on: {
        DISMISS: 'undocking',
        // 点另一个：先记下来再收回当前的
        SELECT: { target: 'undocking', actions: 'queueNext' },
        CANCEL: { target: 'browsing', actions: 'clear' },
      },
    },

    /** 正收回。收回完看有没有排队的 */
    undocking: {
      on: {
        UNDOCKED: [
          { target: 'centering', guard: 'hasPending', actions: 'promotePending' },
          { target: 'browsing', actions: 'clear' },
        ],
        CANCEL: { target: 'browsing', actions: 'clear' },
      },
    },
  },
})

/** 浏览是否可用（转盘/滚动该不该响应） */
export function canBrowse(phase: string): boolean {
  return phase === 'browsing'
}

/** 是否处于任何一种"选中"状态（其余条目该压暗） */
export function hasSelection(phase: string): boolean {
  return phase !== 'browsing'
}
