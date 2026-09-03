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
  showTutorial: (id: string) => void
  unlockAchievement: (id: string) => void
  hidePopup: () => void
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

  // 首次挂载时从存储恢复
  useEffect(() => {
    const stored = loadAchievements().filter(isAchievementId)
    if (stored.length > 0) dispatch({ type: 'HYDRATE', completed: stored })
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
  const lastCompletedCount = useRef(-1)
  useEffect(() => {
    const count = state.completed.length
    // 首次（含从存储恢复）不响：那不是刚刚发生的解锁
    if (lastCompletedCount.current === -1) {
      lastCompletedCount.current = count
      return
    }
    if (count > lastCompletedCount.current) playUnlockChime()
    lastCompletedCount.current = count
  }, [state.completed])

  const showTutorial = useCallback((id: string) => {
    if (!isAchievementId(id)) return
    dispatch({ type: 'SHOW_TUTORIAL', id })
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
    unlockAchievement,
    hidePopup,
    isUnlocked,
  }), [completed, activePopup, showTutorial, unlockAchievement, hidePopup, isUnlocked])

  return (
    <AchievementsCtx.Provider value={value}>
      {children}
    </AchievementsCtx.Provider>
  )
}

