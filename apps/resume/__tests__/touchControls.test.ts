import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTargetZ, nextLookX } from '@/lib/lab/touchControls'
import { hasSeenTutorial, markTutorialSeen } from '@/lib/lab/tutorialStorage'

describe('nextTargetZ (vertical drag → walk)', () => {
  const scrollSpeed = 0.02

  it('finger moving up (negative deltaY) walks forward (Z decreases)', () => {
    const z = nextTargetZ(28, -100, scrollSpeed)
    expect(z).toBeLessThan(28)
    expect(z).toBeCloseTo(28 - 100 * scrollSpeed * 1.5)
  })

  it('finger moving down (positive deltaY) walks backward (Z increases)', () => {
    expect(nextTargetZ(28, 100, scrollSpeed)).toBeGreaterThan(28)
  })

  it('zero delta leaves Z unchanged', () => {
    expect(nextTargetZ(28, 0, scrollSpeed)).toBe(28)
  })

  it('is additive across successive small steps (matches one big step)', () => {
    let z = 28
    for (let i = 0; i < 10; i++) z = nextTargetZ(z, -10, scrollSpeed)
    expect(z).toBeCloseTo(nextTargetZ(28, -100, scrollSpeed))
  })
})

describe('nextLookX (horizontal drag → turn)', () => {
  const viewport = 400
  const intensity = 4.0

  it('finger moving right turns the view right (lookX increases)', () => {
    expect(nextLookX(0, 50, viewport, intensity)).toBeGreaterThan(0)
  })

  it('finger moving left turns the view left (lookX decreases)', () => {
    expect(nextLookX(0, -50, viewport, intensity)).toBeLessThan(0)
  })

  it('clamps at +intensity so the camera cannot over-rotate right', () => {
    let look = 0
    for (let i = 0; i < 50; i++) look = nextLookX(look, 200, viewport, intensity)
    expect(look).toBe(intensity)
  })

  it('clamps at -intensity so the camera cannot over-rotate left', () => {
    let look = 0
    for (let i = 0; i < 50; i++) look = nextLookX(look, -200, viewport, intensity)
    expect(look).toBe(-intensity)
  })

  it('is reversible: equal opposite drags return to centre', () => {
    const after = nextLookX(nextLookX(0, 80, viewport, intensity), -80, viewport, intensity)
    expect(after).toBeCloseTo(0)
  })

  it('guards against a zero-width viewport', () => {
    expect(Number.isFinite(nextLookX(0, 50, 0, intensity))).toBe(true)
  })
})

describe('tutorial persistence', () => {
  // Node's built-in localStorage needs a CLI flag in this environment,
  // so stub a plain in-memory implementation instead.
  function stubStorage(overrides: Partial<Storage> = {}) {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
      ...overrides,
    })
  }

  beforeEach(() => stubStorage())
  afterEach(() => vi.unstubAllGlobals())

  it('reports unseen on first visit', () => {
    expect(hasSeenTutorial()).toBe(false)
  })

  it('reports seen after marking', () => {
    markTutorialSeen()
    expect(hasSeenTutorial()).toBe(true)
  })

  it('fails safe (treated as seen) when localStorage throws', () => {
    stubStorage({ getItem: () => { throw new Error('denied') } })
    expect(hasSeenTutorial()).toBe(true)
  })

  it('markTutorialSeen does not throw when localStorage is unavailable', () => {
    stubStorage({ setItem: () => { throw new Error('denied') } })
    expect(() => markTutorialSeen()).not.toThrow()
  })
})
