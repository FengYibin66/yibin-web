'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SEGMENT_LENGTH, segmentZStart } from '@/components/lab/CorridorSegment'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import { nextTargetZ, nextLookX } from '@/lib/lab/touchControls'

// Door Z positions within a segment (relative to segment start)
const DOOR_RELATIVE_POSITIONS: Array<{ relativeZ: number; side: 'left' | 'right' }> = [
  { relativeZ:  -8, side: 'left'  },
  { relativeZ: -20, side: 'right' },
  { relativeZ: -32, side: 'left'  },
  { relativeZ: -44, side: 'right' },
  { relativeZ: -56, side: 'left'  },
]

const GLANCE_START_DIST = 15
const GLANCE_PEAK_DIST  = 8
const GLANCE_END_DIST   = -2

interface UseCorridorCameraOptions {
  scrollSpeed?:     number   // deltaY multiplier (default 0.02)
  smoothing?:       number   // lerp factor per frame (default 0.035)
  lookIntensity?:   number   // mouse look horizontal range in world units (default 4.0)
  glanceIntensity?: number   // door auto-glance strength (default 0.15)
  scrollEnabled?:   boolean
}

export function useCorridorCamera({
  scrollSpeed    = 0.02,
  smoothing      = 0.035,
  lookIntensity  = 4.0,
  glanceIntensity = 0.15,
  scrollEnabled  = true,
}: UseCorridorCameraOptions = {}) {
  const { camera } = useThree()

  const targetZ       = useRef(28)
  const currentZ      = useRef(28)
  const glance        = useRef(0)
  const targetGlance  = useRef(0)

  // Mouse look
  const look       = useRef({ x: 0, y: 0 })
  const targetLook = useRef({ x: 0, y: 0 })

  const scrollEnabledRef = useRef(scrollEnabled)
  useEffect(() => { scrollEnabledRef.current = scrollEnabled }, [scrollEnabled])

  const cameraOverrideRef = useRef(false)
  const router = useWheelRouter()

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!scrollEnabledRef.current) return
    e.preventDefault()
    targetZ.current = targetZ.current - e.deltaY * scrollSpeed
  }, [scrollSpeed])

  const setCameraOverride = useCallback((active: boolean) => {
    cameraOverrideRef.current = active
    if (active) {
      router.deactivate('corridor')
    } else {
      router.activate('corridor')
      const z = camera.position.z
      targetZ.current  = z
      currentZ.current = z
    }
  }, [camera, router])

  // Register corridor as a wheel consumer via the router
  useEffect(() => {
    const unsub = router.subscribe('corridor', handleWheel, { passive: false })
    router.activate('corridor')
    return () => { unsub(); router.deactivate('corridor') }
  }, [router, handleWheel])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!scrollEnabledRef.current) return
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const delta: Record<string, number> = {
      ArrowDown: 80, ArrowUp: -80, PageDown: 300, PageUp: -300, ' ': 150,
    }
    const d = delta[e.key]
    if (d !== undefined) {
      e.preventDefault()
      targetZ.current = targetZ.current - d * scrollSpeed
    }
  }, [scrollSpeed])

  // After any touch, browsers fire a synthetic mousemove at the tap position.
  // Without this guard, tapping the left/right half of a phone screen would
  // yank the camera sideways — the confusing "tap edges to turn" behaviour.
  const lastTouchTime = useRef(0)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (performance.now() - lastTouchTime.current < 1000) return
    const nx = (e.clientX / window.innerWidth)  * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    targetLook.current.x = nx * lookIntensity
    targetLook.current.y = -ny * 0.4
  }, [lookIntensity])

  // Touch gestures: vertical drag walks, horizontal drag turns.
  // The gesture locks onto its dominant axis after a small dead zone so a
  // slightly diagonal walk-swipe doesn't also swing the camera.
  const AXIS_LOCK_THRESHOLD_PX = 10
  const touchState = useRef({ x: 0, y: 0, startX: 0, startY: 0, axis: null as 'walk' | 'look' | null })

  const handleTouchStart = useCallback((e: TouchEvent) => {
    lastTouchTime.current = performance.now()
    const t = e.touches[0]
    touchState.current = { x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY, axis: null }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!scrollEnabledRef.current) return
    lastTouchTime.current = performance.now()
    const t = e.touches[0]
    const s = touchState.current
    const deltaX = t.clientX - s.x
    const deltaY = t.clientY - s.y
    s.x = t.clientX
    s.y = t.clientY

    if (s.axis === null) {
      const totalX = Math.abs(t.clientX - s.startX)
      const totalY = Math.abs(t.clientY - s.startY)
      if (Math.max(totalX, totalY) < AXIS_LOCK_THRESHOLD_PX) return
      s.axis = totalX > totalY ? 'look' : 'walk'
    }

    if (s.axis === 'walk') {
      targetZ.current = nextTargetZ(targetZ.current, deltaY, scrollSpeed)
    } else {
      targetLook.current.x = nextLookX(targetLook.current.x, deltaX, window.innerWidth, lookIntensity)
    }
  }, [scrollSpeed, lookIntensity])

  useEffect(() => {
    window.addEventListener('keydown',    handleKeyDown)
    window.addEventListener('mousemove',  handleMouseMove)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove',  handleTouchMove,  { passive: true })
    return () => {
      window.removeEventListener('keydown',    handleKeyDown)
      window.removeEventListener('mousemove',  handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove',  handleTouchMove)
    }
  }, [handleKeyDown, handleMouseMove, handleTouchStart, handleTouchMove])

  useFrame(() => {
    if (!scrollEnabledRef.current) return
    if (cameraOverrideRef.current) return

    // Smooth Z (no lower bound — infinite)
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ.current, smoothing)

    // Smooth look
    look.current.x = THREE.MathUtils.lerp(look.current.x, targetLook.current.x, smoothing * 2)
    look.current.y = THREE.MathUtils.lerp(look.current.y, targetLook.current.y, smoothing * 2)

    // Auto-glance: compute the current segment, then check all doors in that segment
    // and the adjacent segments so glance transitions smoothly across segment boundaries.
    const cameraZ    = currentZ.current
    const currentSeg = Math.floor((10 - cameraZ) / SEGMENT_LENGTH)

    let bestStrength = 0
    let bestDir      = 0

    for (const segOffset of [-1, 0, 1]) {
      const seg   = currentSeg + segOffset
      if (seg < 0) continue
      const zBase = segmentZStart(seg)

      for (const door of DOOR_RELATIVE_POSITIONS) {
        const doorZ = zBase + door.relativeZ
        const dist  = cameraZ - doorZ

        let strength = 0
        if (dist > GLANCE_PEAK_DIST && dist < GLANCE_START_DIST) {
          strength = (GLANCE_START_DIST - dist) / (GLANCE_START_DIST - GLANCE_PEAK_DIST)
        } else if (dist <= GLANCE_PEAK_DIST && dist > GLANCE_END_DIST) {
          strength = (dist - GLANCE_END_DIST) / (GLANCE_PEAK_DIST - GLANCE_END_DIST)
        }

        if (strength > 0) {
          const eased = strength * (2 - strength)
          const dir   = door.side === 'left' ? -1 : 1
          if (eased > bestStrength) { bestStrength = eased; bestDir = dir }
        }
      }
    }

    targetGlance.current = bestDir * bestStrength * glanceIntensity * 3.5

    // Slow to glance, fast to release
    const releasing = Math.abs(targetGlance.current) < Math.abs(glance.current)
    glance.current = THREE.MathUtils.lerp(glance.current, targetGlance.current, releasing ? 0.08 : 0.03)

    camera.position.z = currentZ.current
    camera.position.x = 0
    camera.position.y = 0.2 + look.current.y * 0.1

    const lookX = look.current.x + glance.current * 3
    camera.lookAt(lookX, 0.13 + look.current.y * 0.1, currentZ.current - 10)
  })

  return {
    getCameraZ: () => currentZ.current,
    setCameraOverride,
  }
}
