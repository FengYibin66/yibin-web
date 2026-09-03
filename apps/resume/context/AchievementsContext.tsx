'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'

import { loadAchievements, saveAchievements } from '@/lib/lab/achievementStorage'
import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'

// ─── Achievement definitions ──────────────────────────────────────────────────

export interface AchievementDef {
  id: string
  title: string
  label: string
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  corridor_enter:    { id: 'corridor_enter',    title: 'Explorer',      label: 'Click or tap a door to enter' },
  corridor_explore:  { id: 'corridor_explore',  title: 'Wanderer',      label: 'Scroll or swipe to explore' },
  about_scroll:      { id: 'about_scroll',      title: 'Sky Walker',    label: 'Scroll to fly through my story' },
  projects_inspect:  { id: 'projects_inspect',  title: 'Director',      label: 'Drag to rotate and browse' },
  // 文案原为 "Click a project to inspect"——那是 /gallery 还是项目列表时的
  // 说法。它现在是摄影相册，解锁条件也随之改为"打开一张照片"（审计 D1）。
  gallery_inspect:   { id: 'gallery_inspect',   title: 'Art Critic',    label: 'Open a photo in the Gallery' },
  contact_found:     { id: 'contact_found',     title: 'Sociable',      label: 'Find a contact method' },
  publications_read: { id: 'publications_read', title: 'Scholar',       label: 'Read a publication' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupStatus = 'pending' | 'completed' | 'hiding'

export interface ActivePopup {
  id: string
  status: PopupStatus
}

export interface AchievementsState {
  completed: string[]
  activePopup: ActivePopup | null
  showTutorial: (id: string) => void
  unlockAchievement: (id: string) => void
  hidePopup: () => void
  isUnlocked: (id: string) => boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// 读写下沉到 lib/lab/achievementStorage，因为 /gallery 独立路由在本 Provider
// 之外也要能记成就（审计 D1）。本 Provider 现在是那份存储的 React 视图。

/**
 * 解锁提示音。
 *
 * 原实现是裸 `new AudioContext()` 合成的双音，有三个缺陷（审计 C4）：
 *   - **忽略静音**：它绕过 `AudioProvider`，用户关了声音照样响
 *   - **泄漏 AudioContext**：每次解锁新建一个且从不 close，7 个成就就接近
 *     浏览器上限（Chrome 约 6 个并发 AudioContext）
 *   - **基本不响**：`ctx.resume()` 未 await 就检查 `ctx.state`，非用户手势
 *     触发时 state 还是 suspended，于是直接 return
 *
 * 现在走 Mixer 的 sfx 总线：静音、音量、自动播放解锁全部由它统一处理。
 */
function playUnlockChime(): void {
  audioMixer.play('achievement_chime', { volume: 0.7 })
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AchievementsCtx = createContext<AchievementsState | null>(null)

export function useAchievements(): AchievementsState {
  const context = useContext(AchievementsCtx)
  if (!context) throw new Error('useAchievements must be used within an AchievementsProvider')
  return context
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<string[]>(loadAchievements)
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null)

  // Synchronous ref to prevent double-firing on rapid events (scroll)
  const completedRef = useRef<string[]>([])
  useEffect(() => { completedRef.current = completed }, [completed])

  // Ref for activePopup so showTutorial doesn't need it as a dependency
  const activePopupRef = useRef<ActivePopup | null>(null)
  useEffect(() => { activePopupRef.current = activePopup }, [activePopup])

  // 持久化（corridor_enter 的过滤在 saveAchievements 里，读写两侧一致）
  useEffect(() => {
    saveAchievements(completed)
  }, [completed])

  const showTutorial = useCallback((id: string) => {
    if (!ACHIEVEMENTS[id]) return
    if (completedRef.current.includes(id)) return
    setActivePopup({ id, status: 'pending' })
  }, [])

  const unlockAchievement = useCallback((id: string) => {
    if (completedRef.current.includes(id)) return
    completedRef.current = [...completedRef.current, id]

    setCompleted(prev => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })

    playUnlockChime()

    // Only show completed popup if the popup was already showing this ID (as pending).
    // Otherwise, silently mark as completed — the user discovered it without needing the hint.
    setActivePopup(prev => {
      if (prev && prev.id === id) {
        setTimeout(() => setActivePopup(p => p?.id === id ? { ...p, status: 'hiding' } : p), 2000)
        setTimeout(() => setActivePopup(p => p?.id === id ? null : p), 2500)
        return { ...prev, status: 'completed' }
      }
      return prev
    })
  }, [])

  const hidePopup = useCallback(() => {
    setActivePopup(prev => {
      if (!prev || prev.status === 'hiding') return prev
      setTimeout(() => setActivePopup(p => p ? null : p), 500)
      return { ...prev, status: 'hiding' }
    })
  }, [])

  const isUnlocked = useCallback((id: string) => completed.includes(id), [completed])

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
