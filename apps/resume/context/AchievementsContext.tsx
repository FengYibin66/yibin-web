'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

interface Achievement {
  id: string
  title: string
  label: string
}

const ACHIEVEMENTS: Record<string, Achievement> = {
  corridor_enter:    { id: 'corridor_enter',    title: 'Explorer',      label: 'Click a door to enter' },
  corridor_explore:  { id: 'corridor_explore',  title: 'Wanderer',      label: 'Scroll to explore' },
  about_scroll:      { id: 'about_scroll',      title: 'Time Traveler', label: 'Scroll through my story' },
  projects_inspect:  { id: 'projects_inspect',  title: 'Critic',        label: 'Open a project detail' },
  contact_found:     { id: 'contact_found',     title: 'Sociable',      label: 'Find a contact method' },
  publications_read: { id: 'publications_read', title: 'Scholar',       label: 'Read a publication' },
}

export { ACHIEVEMENTS }

export interface AchievementsState {
  unlocked: Set<string>
  unlock: (id: string) => void
  isUnlocked: (id: string) => boolean
}

function loadFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const saved = localStorage.getItem('resume_achievements')
    if (!saved) return new Set()
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) return new Set(parsed as string[])
  } catch {
    // ignore parse errors
  }
  return new Set()
}

const AchievementsCtx = createContext<AchievementsState | null>(null)

export function useAchievements(): AchievementsState {
  const context = useContext(AchievementsCtx)
  if (!context) {
    throw new Error('useAchievements must be used within an AchievementsProvider')
  }
  return context
}

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<Set<string>>(loadFromStorage)

  const unlock = useCallback((id: string) => {
    setUnlocked(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem('resume_achievements', JSON.stringify(Array.from(next)))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const isUnlocked = useCallback((id: string) => {
    return unlocked.has(id)
  }, [unlocked])

  const value = useMemo<AchievementsState>(() => ({
    unlocked,
    unlock,
    isUnlocked,
  }), [unlocked, unlock, isUnlocked])

  return (
    <AchievementsCtx.Provider value={value}>
      {children}
    </AchievementsCtx.Provider>
  )
}
