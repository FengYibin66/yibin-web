import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS } from '@/context/AchievementsContext'

// ─── ACHIEVEMENTS registry ────────────────────────────────────────────────────

describe('ACHIEVEMENTS registry', () => {
  it('contains all 7 expected achievement IDs', () => {
    const ids = Object.keys(ACHIEVEMENTS)
    expect(ids).toContain('corridor_enter')
    expect(ids).toContain('corridor_explore')
    expect(ids).toContain('about_scroll')
    expect(ids).toContain('projects_inspect')
    expect(ids).toContain('gallery_inspect')
    expect(ids).toContain('contact_found')
    expect(ids).toContain('publications_read')
  })

  it('each achievement has required fields', () => {
    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      expect(def.id).toBe(id)
      expect(typeof def.title).toBe('string')
      expect(def.title.length).toBeGreaterThan(0)
      expect(typeof def.label).toBe('string')
      expect(def.label.length).toBeGreaterThan(0)
    }
  })
})

// ─── Pure extract: popup state machine logic from AchievementsContext ─────────

type Popup = { id: string; status: 'pending' | 'completed' | 'hiding' }

function showTutorialLogic(
  id: string,
  completed: string[],
  achievements: Record<string, { id: string; title: string; label: string }>
): Popup | null {
  if (!achievements[id]) return null
  if (completed.includes(id)) return null
  return { id, status: 'pending' }
}

function unlockAchievementLogic(
  id: string,
  completedSet: Set<string>,
  prev: Popup | null
): { added: boolean; popup: Popup | null } {
  if (completedSet.has(id)) return { added: false, popup: prev }
  completedSet.add(id)
  if (prev && prev.id === id) {
    return { added: true, popup: { ...prev, status: 'completed' } }
  }
  return { added: true, popup: null }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('showTutorial', () => {
  it('returns pending popup for a new achievement', () => {
    const result = showTutorialLogic('about_scroll', [], ACHIEVEMENTS)
    expect(result).toEqual({ id: 'about_scroll', status: 'pending' })
  })

  it('returns null for an already-completed achievement', () => {
    const result = showTutorialLogic('about_scroll', ['about_scroll'], ACHIEVEMENTS)
    expect(result).toBeNull()
  })

  it('returns null for an invalid ID', () => {
    expect(showTutorialLogic('nonexistent', [], ACHIEVEMENTS)).toBeNull()
  })
})

describe('unlockAchievement', () => {
  it('adds new achievement, no popup if not currently showing', () => {
    const set = new Set<string>()
    const r = unlockAchievementLogic('about_scroll', set, null)
    expect(r.added).toBe(true)
    expect(r.popup).toBeNull()
    expect(set.has('about_scroll')).toBe(true)
  })

  it('transitions pending popup → completed when same id', () => {
    const set = new Set<string>()
    const r = unlockAchievementLogic('about_scroll', set, { id: 'about_scroll', status: 'pending' })
    expect(r.added).toBe(true)
    expect(r.popup).toEqual({ id: 'about_scroll', status: 'completed' })
  })

  it('is idempotent — second call does nothing', () => {
    const set = new Set<string>()
    unlockAchievementLogic('about_scroll', set, null)
    const r2 = unlockAchievementLogic('about_scroll', set, null)
    expect(r2.added).toBe(false)
    expect(r2.popup).toBeNull()
  })
})

describe('full flow: corridor hint → room hint overwrites → unlock', () => {
  it('about_scroll overwrites corridor_enter because last request wins', () => {
    const set = new Set<string>()

    // 1. NavigationUI shows corridor_enter hint
    const c1 = showTutorialLogic('corridor_enter', [], ACHIEVEMENTS)
    expect(c1).toEqual({ id: 'corridor_enter', status: 'pending' })

    // 2. After 2s, AboutRoom fires showTutorial('about_scroll') — overwrites
    const c2 = showTutorialLogic('about_scroll', [], ACHIEVEMENTS)
    expect(c2).toEqual({ id: 'about_scroll', status: 'pending' })

    // 3. User scrolls → unlockAchievement
    const c3 = unlockAchievementLogic('about_scroll', set, c2)
    expect(c3.popup!.status).toBe('completed')
  })

  it('re-entering a room after completion does not re-show hint', () => {
    const completed = ['about_scroll']
    const result = showTutorialLogic('about_scroll', completed, ACHIEVEMENTS)
    expect(result).toBeNull()
  })
})
