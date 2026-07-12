'use client'

import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * Stable wrapper around drei's useProgress.
 *
 * Problem: three.js's global LoadingManager resets its item counters every
 * time a load "wave" finishes (onLoad fires). Because useTexture calls inside
 * a component resolve sequentially (suspense waterfall), texture loading
 * happens in multiple waves — so the raw progress jumps 0 → 100 → 0 → 100…
 * Treating the first `progress === 100` as "done" fires exit animations too
 * early and leaves the scene blank while later waves are still loading.
 *
 * Guarantees provided here:
 * 1. `progress` is monotonic — it never goes backwards. It is capped at 99
 *    until loading is genuinely complete, then jumps to 100.
 * 2. `complete` only becomes true after raw progress reached 100 AND no new
 *    load activity started for `quietMs` milliseconds. Once true it latches.
 */
export function useStableProgress(quietMs = 600): { progress: number; complete: boolean } {
  const { progress: raw, active } = useProgress()
  const maxRef = useRef(0)
  const [complete, setComplete] = useState(false)

  if (raw > maxRef.current) maxRef.current = raw

  // Debug instrumentation — helps diagnose load waves on real devices.
  const prevActiveRef = useRef(active)
  useEffect(() => {
    if (prevActiveRef.current !== active) {
      console.info(`[progress] wave ${active ? 'started' : 'ended'} (raw=${raw.toFixed(0)}%)`)
      prevActiveRef.current = active
    }
  }, [active, raw])

  useEffect(() => {
    if (complete || active || raw < 100) return
    // Raw hit 100 and nothing is loading — wait for a quiet period before
    // declaring completion, in case another wave starts right after.
    const timer = setTimeout(() => {
      console.info(`[progress] complete (quiet for ${quietMs}ms)`)
      setComplete(true)
    }, quietMs)
    return () => clearTimeout(timer)
  }, [complete, active, raw, quietMs])

  const progress = complete ? 100 : Math.min(99, Math.round(maxRef.current))
  return { progress, complete }
}
