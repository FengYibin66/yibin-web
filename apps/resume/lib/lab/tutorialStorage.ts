/** Persistence for the one-time Lab controls tutorial. */

const STORAGE_KEY = 'lab_tutorial_seen'

export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // private mode etc. — tutorial will just show again next visit
  }
}

/** Custom event name used by the "?" nav button to reopen the tutorial. */
export const TUTORIAL_OPEN_EVENT = 'lab:tutorial-open'
