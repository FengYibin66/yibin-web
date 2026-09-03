/**
 * 成就气泡的队列 —— 纯状态机式 reducer，无 React、无定时器。
 *
 * ## 修的三个 bug（审计 D2 / D3 / D4）
 *
 * 原实现是**单槽** `activePopup` 加三个裸 `setTimeout`：
 *
 * - **D2**：首访时 `hasEntered` 在同一 tick 内 false→true，两次
 *   `showTutorial` 后者覆盖前者——"Click a door" 只显示一帧就被
 *   "Scroll to explore" 顶掉；而回访时反倒一直显示，与意图相反。
 * - **D3**：`hidePopup` 起的 500ms 定时器**不校验 id**，于是它会把这 500ms
 *   内新弹出的气泡一起清掉（`unlockAchievement` 的定时器有校验，两处不一致）。
 * - **D4**：气泡 A 待完成时 B 弹出 → A 静默消失，之后完成 A 也不庆祝。
 *
 * 共同根因是「同一时刻只能有一个气泡，而覆盖策略没定义」。三个都不是能靠
 * 加判断修的——需要先定义「多个气泡同时想显示时谁赢」。
 *
 * ## 策略
 *
 * 一个队列 + 一条优先级规则：
 *
 * - **已解锁的庆祝插队**，因为它是对用户刚才动作的反馈，晚了就失去因果关系
 * - **教程提示排队**，先来先显示；重复的同一条不入队两次
 * - 队首显示完（或被 dismiss）才轮到下一条
 *
 * 时间由调用侧驱动（`tick`），所以队列本身是纯的、可完整单测。
 */
import type { AchievementId } from '../ids'

/** 气泡的两种形态 */
export type PopupKind = 'tutorial' | 'completed'

export interface Popup {
  id: AchievementId
  kind: PopupKind
  /** 已显示的毫秒数。到 `durationFor(kind)` 后自动进入淡出 */
  elapsed: number
  /** 正在淡出 */
  hiding: boolean
}

export interface QueueState {
  /** 队首是当前显示的那个 */
  queue: readonly Popup[]
  completed: readonly AchievementId[]
}

export const DURATIONS = {
  /** 庆祝：够读一眼就够 */
  completed: 2000,
  /** 教程：给用户时间照着做 */
  tutorial: 9000,
  /** 淡出时长 */
  fade: 500,
} as const

export function durationFor(kind: PopupKind): number {
  return kind === 'completed' ? DURATIONS.completed : DURATIONS.tutorial
}

export const initialQueueState: QueueState = { queue: [], completed: [] }

export type QueueAction =
  | { type: 'SHOW_TUTORIAL'; id: AchievementId }
  | { type: 'UNLOCK'; id: AchievementId }
  | { type: 'DISMISS' }
  | { type: 'TICK'; delta: number }
  | { type: 'HYDRATE'; completed: readonly AchievementId[] }

function newPopup(id: AchievementId, kind: PopupKind): Popup {
  return { id, kind, elapsed: 0, hiding: false }
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, completed: [...action.completed] }

    case 'SHOW_TUTORIAL': {
      // 已经解锁了就不必再教
      if (state.completed.includes(action.id)) return state
      // 已在队列里（不管是队首还是排队中）不重复入队 —— D2 的"同一 tick 两次
      // showTutorial"就变成幂等的
      if (state.queue.some(p => p.id === action.id)) return state
      return { ...state, queue: [...state.queue, newPopup(action.id, 'tutorial')] }
    }

    case 'UNLOCK': {
      if (state.completed.includes(action.id)) return state
      const completed = [...state.completed, action.id]

      /*
        庆祝插队到队首。

        它是对用户刚才那个动作的反馈——排在一条 9 秒的教程后面就完全失去
        因果关系了。原实现的表现是"完成 A 时若气泡显示的是 B，A 就静默
        完成、永远不庆祝"（D4）。
      */
      const rest = state.queue.filter(p => p.id !== action.id)
      return { completed, queue: [newPopup(action.id, 'completed'), ...rest] }
    }

    case 'DISMISS': {
      const [head, ...rest] = state.queue
      if (!head) return state
      // 已经在淡出就别重复触发（否则 elapsed 被重置，淡出永远走不完）
      if (head.hiding) return state
      return { ...state, queue: [{ ...head, hiding: true, elapsed: 0 }, ...rest] }
    }

    case 'TICK': {
      const [head, ...rest] = state.queue
      if (!head) return state
      const elapsed = head.elapsed + action.delta

      if (head.hiding) {
        // 淡出走完 → 出队，队首换成下一条
        return elapsed >= DURATIONS.fade
          ? { ...state, queue: rest }
          : { ...state, queue: [{ ...head, elapsed }, ...rest] }
      }

      /*
        教程气泡**不自动消失**。

        它在等用户照着做——自动消失会让"我还没看完就没了"。只有被解锁
        （UNLOCK 插队）或显式 DISMISS 才走。庆祝气泡则到时自动淡出。
      */
      if (head.kind === 'tutorial') {
        return { ...state, queue: [{ ...head, elapsed }, ...rest] }
      }

      return elapsed >= durationFor(head.kind)
        ? { ...state, queue: [{ ...head, hiding: true, elapsed: 0 }, ...rest] }
        : { ...state, queue: [{ ...head, elapsed }, ...rest] }
    }
  }
}

/** 当前该显示哪个气泡。`null` = 不显示 */
export function activePopup(state: QueueState): Popup | null {
  return state.queue[0] ?? null
}

/** 排队中还有几个（调试与测试用） */
export function pendingCount(state: QueueState): number {
  return Math.max(0, state.queue.length - 1)
}

export function isUnlocked(state: QueueState, id: AchievementId): boolean {
  return state.completed.includes(id)
}
