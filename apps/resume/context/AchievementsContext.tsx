'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'

import { loadAchievements, saveAchievements } from '@/lib/lab/achievementStorage'
import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import { isAchievementId } from '@/lib/lab/domain/ids'
import {
  activePopup as selectActivePopup,
  initialQueueState,
  queueReducer,
  type Popup,
  type PopupScope,
} from '@/lib/lab/domain/achievements/queue'

/*
  成就的**文案**不在这里。

  原先这个文件有一张 `ACHIEVEMENTS: Record<string, {id, title, label}>` 的英文
  表，与 `content[locale].labUi.tutorials` 重复——而后者才是 i18n 的来源。
  两份文案的后果就是审计 E7：中文用户看到英文成就名包着中文房间内容。

  现在 id 的唯一来源是 `domain/ids` 的 `ACHIEVEMENT_IDS`，文案的唯一来源是
  `labUi.tutorials`（用 `useLabLabels()` 取）。
*/

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupStatus = 'pending' | 'completed' | 'hiding'

export interface ActivePopup {
  id: string
  status: PopupStatus
  /** 气泡本来是哪一种。淡出时 `status` 变成 'hiding'，样式仍要按这个走 */
  kind: Popup['kind']
}

export interface AchievementsState {
  completed: string[]
  activePopup: ActivePopup | null
  /**
   * 弹一条教程提示。
   *
   * `scope` 声明它属于哪个场景，离开那个场景时自动出队（ADR 20260903211302）。
   * 这个参数是**必填**的：原先没有它，"什么时候该关掉"由四个互不知情的房间组件
   * 各自负责，结果只有一间房做了——教程气泡退房后残留并堵死队列，让后续所有
   * 教程永远显示不出来。
   */
  showTutorial: (id: string, scope: PopupScope) => void
  unlockAchievement: (id: string) => void
  /** 关掉当前显示的那一条（走淡出） */
  hidePopup: () => void
  /** 按 id 关掉某一条 —— 房间自己收尾时用 */
  dismissTutorial: (id: string) => void
  /**
   * 进入一个场景：把不属于它、也不是 `global` 的气泡全部出队。
   *
   * 这是**唯一**需要被调用的清理入口。比"每个房间在卸载时关自己的"强：清理动作
   * 只发生在一处（场景切换），漏不掉。
   */
  enterScope: (scope: PopupScope) => void
  isUnlocked: (id: string) => boolean
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * 队列的推进步长。
 *
 * 100ms 足够：气泡的时长以秒计，肉眼分不出 100ms 的抖动。用
 * `setInterval` 而不是 rAF——rAF 在标签页隐藏时停摆，切回来会一次性
 * 补上一大段 delta，气泡瞬间消失。
 */
const TICK_MS = 100

const AchievementsCtx = createContext<AchievementsState | null>(null)

export function useAchievements(): AchievementsState {
  const context = useContext(AchievementsCtx)
  if (!context) throw new Error('useAchievements must be used within an AchievementsProvider')
  return context
}

/** 只有动作、没有状态的那一半：值永远不变，订阅它的组件不会因为队列变化重渲染 */
export type AchievementActions = Pick<
  AchievementsState,
  'unlockAchievement' | 'showTutorial' | 'dismissTutorial' | 'enterScope' | 'hidePopup'
>

const AchievementActionsCtx = createContext<AchievementActions | null>(null)

/**
 * 给只需要**触发**成就 / 教程、不需要读队列的组件用。
 *
 * ## 为什么要拆
 *
 * 气泡在屏幕上时，`TICK` 每 100ms 派发一次推进 `elapsed`，`AchievementsCtx` 的
 * value 随之变化——**所有** `useAchievements()` 的订阅者都重渲染。走廊有 15 个
 * `DoorSection` 实例，每个只用 `unlockAchievement`（一个 `[]` 依赖的稳定回调），
 * 却被拖着每秒渲染 10 次；2026-09-04 滚过第 1/2 段交界时 CPU 采样到 1.4 秒纯
 * React 元素创建，`DoorSection` 一项 1.2 秒。
 *
 * 五个动作回调的依赖全是 `[]`，所以这个 context 的 value 在整个生命周期只创建一次。
 */
export function useAchievementActions(): AchievementActions {
  const context = useContext(AchievementActionsCtx)
  if (!context) throw new Error('useAchievementActions must be used within an AchievementsProvider')
  return context
}

/**
 * 解锁提示音。
 *
 * 原实现是裸 `new AudioContext()` 合成的双音，有三个缺陷（审计 C4）：
 * 忽略静音、每次新建一个从不 close 的 AudioContext、非用户手势触发时基本
 * 不响。现在走 Mixer 的 sfx 总线（ADR 20260903140618）。
 */
function playUnlockChime(): void {
  audioMixer.play('achievement_chime', { volume: 0.7 })
}

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  /**
   * 气泡队列（ADR 20260903140616 的 reducer 化）。
   *
   * 取代原先的单槽 `activePopup` + 三个裸 setTimeout。那套有三个 bug——
   * D2（同一 tick 两次 showTutorial 互相覆盖）、D3（hidePopup 的定时器不校验
   * id，清掉后来的气泡）、D4（气泡 A 待完成时 B 弹出，A 静默消失）——共同
   * 根因是「同一时刻只能有一个气泡，而覆盖策略没定义」。策略与其测试都在
   * `domain/achievements/queue.ts`。
   */
  const [state, dispatch] = useReducer(queueReducer, initialQueueState)

  /*
    首次挂载时从存储恢复。

    **无条件派发**，哪怕存储是空的：`HYDRATE` 同时把 `hydrated` 置为 true，
    而解锁音的基线要等它。原先是 `if (stored.length > 0)`，于是首访用户永远
    `hydrated: false`。
  */
  useEffect(() => {
    const stored = loadAchievements().filter(isAchievementId)
    dispatch({ type: 'HYDRATE', completed: stored })
  }, [])

  useEffect(() => {
    saveAchievements([...state.completed])
  }, [state.completed])

  /**
   * 推进队列。
   *
   * 只在队列非空时开定时器——空队列还每 100ms 跑一次 reducer 是白烧电，
   * 而且会让 React DevTools 的更新记录里全是噪声。
   */
  const hasPopup = state.queue.length > 0
  useEffect(() => {
    if (!hasPopup) return
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', delta: TICK_MS }),
      TICK_MS,
    )
    return () => window.clearInterval(timer)
  }, [hasPopup])

  /**
   * 解锁时响一声。
   *
   * 用 ref 记上一次的长度而不是在 `unlockAchievement` 里直接播：
   * reducer 会去重（重复解锁返回同一个 state），所以"真的新解锁了"这件事
   * 只有比较前后状态才知道。在回调里播会让重复点击响多次。
   */
  /*
    基线在 **HYDRATE 之后**建立，不在首帧。

    原先在首帧建立（那时 `completed` 是空的），而 `HYDRATE` 是上面那个 effect
    异步派发的——于是回访用户的序列是 `0 → N`，被判成"刚解锁了 N 条"，
    **每次进 Lab 都响一声解锁音**。原注释写着「首次（含从存储恢复）不响」，
    与实际行为相反：注释描述的是意图，代码实现的是另一件事。

    这一层此前**零测试**（其余测试全部 mock 掉 `useAchievements`），所以队列
    reducer 再正确也保不住 React 侧的接线。现在有
    `__tests__/achievementsContext.test.tsx`。
  */
  const chimeBaseline = useRef<number | null>(null)
  useEffect(() => {
    if (!state.hydrated) return
    const count = state.completed.length
    if (chimeBaseline.current === null) {
      chimeBaseline.current = count
      return
    }
    if (count > chimeBaseline.current) playUnlockChime()
    chimeBaseline.current = count
  }, [state.hydrated, state.completed])

  const showTutorial = useCallback((id: string, scope: PopupScope) => {
    if (!isAchievementId(id)) return
    dispatch({ type: 'SHOW_TUTORIAL', id, scope })
  }, [])

  const dismissTutorial = useCallback((id: string) => {
    if (!isAchievementId(id)) return
    dispatch({ type: 'DISMISS_ID', id })
  }, [])

  const enterScope = useCallback((scope: PopupScope) => {
    dispatch({ type: 'ENTER_SCOPE', scope })
  }, [])

  const unlockAchievement = useCallback((id: string) => {
    if (!isAchievementId(id)) return
    dispatch({ type: 'UNLOCK', id })
  }, [])

  const hidePopup = useCallback(() => dispatch({ type: 'DISMISS' }), [])

  const completed = useMemo(() => [...state.completed], [state.completed])

  const activePopup = useMemo<ActivePopup | null>(() => {
    const popup = selectActivePopup(state)
    if (!popup) return null
    return {
      id: popup.id,
      status: popup.hiding ? 'hiding' : popup.kind === 'completed' ? 'completed' : 'pending',
      kind: popup.kind,
    }
  }, [state])

  const isUnlocked = useCallback(
    (id: string) => (isAchievementId(id) ? state.completed.includes(id) : false),
    [state.completed],
  )

  const value = useMemo<AchievementsState>(() => ({
    completed,
    activePopup,
    showTutorial,
    dismissTutorial,
    enterScope,
    unlockAchievement,
    hidePopup,
    isUnlocked,
  }), [
    completed,
    activePopup,
    showTutorial,
    dismissTutorial,
    enterScope,
    unlockAchievement,
    hidePopup,
    isUnlocked,
  ])

  const actions = useMemo<AchievementActions>(() => ({
    unlockAchievement,
    showTutorial,
    dismissTutorial,
    enterScope,
    hidePopup,
  }), [unlockAchievement, showTutorial, dismissTutorial, enterScope, hidePopup])

  return (
    <AchievementActionsCtx.Provider value={actions}>
      <AchievementsCtx.Provider value={value}>
        {children}
      </AchievementsCtx.Provider>
    </AchievementActionsCtx.Provider>
  )
}

