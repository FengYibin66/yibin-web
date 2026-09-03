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

/**
 * 气泡的**作用域** —— 它属于哪个场景，离开那个场景就该消失（ADR 20260903211302）。
 *
 * ## 为什么需要这个字段
 *
 * 教程气泡刻意不自动消失（它在等用户照着做）。但"什么时候该消失"原先完全由调用侧
 * 负责，而调用侧是四个互不知情的房间组件加一个走廊——结果全仓只有
 * `PublicationsRoom` 在退场时关掉自己的气泡。
 *
 * 实际表现：进 About 不滚动 → 2 秒后弹出教程 → 退回走廊 → **气泡一直挂着**；
 * 再进别的房间，它的教程排在队列第二位，**永远显示不出来**。也就是说漏掉一处
 * 不是"多一个气泡"，而是**教程系统整体失效**，且没有任何症状指向队列。
 * 审计 A7 记录过这条并标为已修，实际只修了一间房。
 *
 * ## 语义
 *
 * - `'corridor'`：走廊里的提示（"滚动探索"）。进任何房间时清掉
 * - `` `room:${RoomId}` ``：某间房的教程。离开那间房时清掉
 * - `'global'`：与场景无关（成就庆祝）。只按时长淡出，不受场景切换影响
 *
 * 生命周期归属从"每个创建者记得销毁"转移到**状态自己声明**——加房间不需要记住
 * 任何事。这与 ADR 20260903211244（相机所有权改显式持有者）是同一条规则在 UI
 * 状态侧的应用：凡是"漏了不报错、症状远离原因"的约定，都换成能被结构保证的形态。
 */
export type PopupScope = 'global' | 'corridor' | `room:${string}`

export interface Popup {
  id: AchievementId
  kind: PopupKind
  /** 属于哪个场景。离开该场景时由 `DISMISS_SCOPE` 批量出队 */
  scope: PopupScope
  /** 已显示的毫秒数。到 `durationFor(kind)` 后自动进入淡出 */
  elapsed: number
  /** 正在淡出 */
  hiding: boolean
}

export interface QueueState {
  /** 队首是当前显示的那个 */
  queue: readonly Popup[]
  completed: readonly AchievementId[]
  /**
   * 是否已从存储恢复过。
   *
   * ## 为什么这个布尔必须在 state 里
   *
   * 解锁音的判定是"`completed` 的长度变大了"，基线用一个 ref 记。原实现在**首帧**
   * 建立基线（那时 `completed` 是空的），而 `HYDRATE` 是 effect 里异步派发的
   * ——于是回访用户的序列是 `0 → N`，被判成"刚解锁了 N 条"，**每次进 Lab 都响
   * 一声**。代码注释写着「首次（含从存储恢复）不响」，与实际行为相反。
   *
   * 把"恢复过了吗"放进 state，基线就能等到 `HYDRATE` 之后再建立，不依赖 effect
   * 的执行顺序。也不能改成在 `useReducer` 的初始化函数里同步读 storage：那是在
   * render 期间读，静态导出的预渲染 HTML 与客户端首帧会不一致，换来一个 hydration
   * mismatch。
   *
   * `HYDRATE` 因此**必须无条件派发**（哪怕存储是空的），否则首访用户永远是
   * `hydrated: false`，解锁音一次都不响。
   */
  hydrated: boolean
}

export const DURATIONS = {
  /** 庆祝：够读一眼就够 */
  completed: 2000,
  /** 淡出时长 */
  fade: 500,
} as const

/*
  这里原来还有一个 `tutorial: 9000`，而 `TICK` 里对 `kind === 'tutorial'` 直接
  `return`——那个数字**从来没生效过**。留着它会让下一个人以为教程会在 9 秒后
  自动消失，然后基于这个错误前提去查"为什么它不消失"。

  教程不设自动时限是刻意的（它在等用户照着做，自动消失就失去意义）；
  该让它消失的是**离开作用域**，见 `PopupScope`。ADR 20260903211302 把
  「给教程一个长时限」作为拒绝项记录：那只是把"永久遮挡"变成"遮挡 15 秒"，
  不解决问题。
*/
export function durationFor(kind: PopupKind): number {
  return kind === 'completed' ? DURATIONS.completed : Number.POSITIVE_INFINITY
}

export const initialQueueState: QueueState = { queue: [], completed: [], hydrated: false }

export type QueueAction =
  | { type: 'SHOW_TUTORIAL'; id: AchievementId; scope: PopupScope }
  | { type: 'UNLOCK'; id: AchievementId }
  | { type: 'DISMISS' }
  /** 按 id 出队（某个房间自己收尾） */
  | { type: 'DISMISS_ID'; id: AchievementId }
  /** 离开某个作用域：把属于它的全部气泡出队 */
  | { type: 'DISMISS_SCOPE'; scope: PopupScope }
  /** 场景切换：只保留 `global` 与指定作用域的气泡 */
  | { type: 'ENTER_SCOPE'; scope: PopupScope }
  | { type: 'TICK'; delta: number }
  | { type: 'HYDRATE'; completed: readonly AchievementId[] }

function newPopup(id: AchievementId, kind: PopupKind, scope: PopupScope): Popup {
  return { id, kind, scope, elapsed: 0, hiding: false }
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, completed: [...action.completed], hydrated: true }

    case 'SHOW_TUTORIAL': {
      // 已经解锁了就不必再教
      if (state.completed.includes(action.id)) return state
      // 已在队列里（不管是队首还是排队中）不重复入队 —— D2 的"同一 tick 两次
      // showTutorial"就变成幂等的
      if (state.queue.some(p => p.id === action.id)) return state
      return {
        ...state,
        queue: [...state.queue, newPopup(action.id, 'tutorial', action.scope)],
      }
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
      /*
        插队时**丢掉正在淡出的队首**。

        不丢的话它会被挤到第二位、`hiding: true` 与 `elapsed` 原样保留，于是庆祝
        播完之后它以淡出状态**重新出现**，播完剩下的那不到 500ms——一个已经在
        消失的气泡又闪一下。review 把这条叫"幽灵气泡"。
      */
      const rest = state.queue
        .filter(p => p.id !== action.id)
        .filter((p, index) => !(index === 0 && p.hiding))
      return { ...state, completed, queue: [newPopup(action.id, 'completed', 'global'), ...rest] }
    }

    case 'DISMISS_ID': {
      const target = state.queue.find(p => p.id === action.id)
      if (!target) return state
      // 队首要走淡出，后面的直接出队（它们还没显示过，没有可淡出的东西）
      if (state.queue[0]?.id === action.id) {
        return queueReducer(state, { type: 'DISMISS' })
      }
      return { ...state, queue: state.queue.filter(p => p.id !== action.id) }
    }

    case 'DISMISS_SCOPE':
      return { ...state, queue: state.queue.filter(p => p.scope !== action.scope) }

    case 'ENTER_SCOPE':
      /*
        进入一个场景：把不属于它、也不是 `global` 的气泡全部出队。

        比"离开时各自清理"更强：清理动作只发生在**一处**（场景切换），
        而不是每个房间的卸载路径里各写一遍——漏一处就是教程系统整体失效。
      */
      return {
        ...state,
        queue: state.queue.filter(p => p.scope === 'global' || p.scope === action.scope),
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
