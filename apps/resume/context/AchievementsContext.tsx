'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Achievement definitions ──────────────────────────────────────────────────

export interface AchievementDef {
  id: string
  title: string
  label: string
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  corridor_enter:    { id: 'corridor_enter',    title: 'Explorer',      label: 'Click a door to enter' },
  corridor_explore:  { id: 'corridor_explore',  title: 'Wanderer',      label: 'Scroll to explore the corridor' },
  about_scroll:      { id: 'about_scroll',      title: 'Sky Walker',    label: 'Scroll to fly through my story' },
  projects_inspect:  { id: 'projects_inspect',  title: 'Director',      label: 'Drag to rotate and browse' },
  gallery_inspect:   { id: 'gallery_inspect',   title: 'Art Critic',    label: 'Click a project to inspect' },
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

function loadFromStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('resume_achievements')
    if (!saved) return []
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      // corridor_enter is intentionally not persisted so the tutorial always shows
      return (parsed as string[]).filter(id => id !== 'corridor_enter')
    }
  } catch {
    // ignore
  }
  return []
}

function playUnlockChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (ctx.state !== 'running') return

    const gain = ctx.createGain()
    const osc = ctx.createOscillator()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // silently fail
  }
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
  const [completed, setCompleted] = useState<string[]>(loadFromStorage)
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null)

  // Synchronous ref to prevent double-firing on rapid events (scroll)
  const completedRef = useRef<string[]>([])
  useEffect(() => { completedRef.current = completed }, [completed])

  // Ref for activePopup so showTutorial doesn't need it as a dependency
  const activePopupRef = useRef<ActivePopup | null>(null)
  useEffect(() => { activePopupRef.current = activePopup }, [activePopup])

  // Persist (excluding corridor_enter which always re-shows)
  useEffect(() => {
    try {
      const toSave = completed.filter(id => id !== 'corridor_enter')
      localStorage.setItem('resume_achievements', JSON.stringify(toSave))
    } catch { /* ignore */ }
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
