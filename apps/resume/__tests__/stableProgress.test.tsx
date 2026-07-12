import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Controllable mock for drei's useProgress (three LoadingManager wrapper)
const mockState = { progress: 0, active: false }

vi.mock('@react-three/drei', () => ({
  useProgress: () => ({ progress: mockState.progress, active: mockState.active }),
}))

import { useStableProgress } from '@/hooks/useStableProgress'

function setRaw(progress: number, active: boolean) {
  mockState.progress = progress
  mockState.active = active
}

describe('useStableProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    setRaw(0, false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts at 0 and not complete', () => {
    const { result } = renderHook(() => useStableProgress(600))
    expect(result.current.progress).toBe(0)
    expect(result.current.complete).toBe(false)
  })

  it('tracks raw progress while loading', () => {
    const { result, rerender } = renderHook(() => useStableProgress(600))
    setRaw(42, true)
    rerender()
    expect(result.current.progress).toBe(42)
    expect(result.current.complete).toBe(false)
  })

  it('is monotonic: does not go backwards when a new load wave resets raw progress', () => {
    const { result, rerender } = renderHook(() => useStableProgress(600))
    setRaw(70, true)
    rerender()
    expect(result.current.progress).toBe(70)

    // LoadingManager reset: second wave starts, raw drops to 10
    setRaw(10, true)
    rerender()
    expect(result.current.progress).toBe(70)

    setRaw(80, true)
    rerender()
    expect(result.current.progress).toBe(80)
  })

  it('caps display at 99 until stable completion, then jumps to 100', () => {
    const { result, rerender } = renderHook(() => useStableProgress(600))
    setRaw(100, false)
    rerender()
    // Raw hit 100 but quiet period not elapsed — display capped at 99
    expect(result.current.progress).toBe(99)
    expect(result.current.complete).toBe(false)

    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.complete).toBe(true)
    expect(result.current.progress).toBe(100)
  })

  it('does NOT complete if a new wave starts during the quiet period', () => {
    const { result, rerender } = renderHook(() => useStableProgress(600))
    setRaw(100, false)
    rerender()
    act(() => { vi.advanceTimersByTime(300) })

    // Second wave begins before quiet period elapsed — timer must be cancelled
    setRaw(20, true)
    rerender()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.complete).toBe(false)
    // Display stays monotonic at 99 (max seen was 100, capped)
    expect(result.current.progress).toBe(99)

    // Second wave finishes and stays quiet — now completion is allowed
    setRaw(100, false)
    rerender()
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.complete).toBe(true)
    expect(result.current.progress).toBe(100)
  })

  it('completion latches: later load activity does not reset it', () => {
    const { result, rerender } = renderHook(() => useStableProgress(600))
    setRaw(100, false)
    rerender()
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.complete).toBe(true)

    // e.g. a room lazily loads textures afterwards
    setRaw(5, true)
    rerender()
    expect(result.current.complete).toBe(true)
    expect(result.current.progress).toBe(100)
  })

  it('respects a custom quietMs', () => {
    const { result, rerender } = renderHook(() => useStableProgress(1200))
    setRaw(100, false)
    rerender()
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.complete).toBe(false)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.complete).toBe(true)
  })
})
