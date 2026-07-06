'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Door Z positions for auto-glance — both loops covered
const DOOR_POSITIONS = [
  // Loop 1
  { z:  -18, side: 'left'  },
  { z:  -32, side: 'right' },
  { z:  -48, side: 'left'  },
  { z:  -62, side: 'right' },
  { z:  -75, side: 'left'  },
  // Loop 2 (offset -100)
  { z: -118, side: 'left'  },
  { z: -132, side: 'right' },
  { z: -148, side: 'left'  },
  { z: -162, side: 'right' },
  { z: -175, side: 'left'  },
] as const

interface UseCorridorCameraOptions {
  scrollSpeed?: number        // deltaY multiplier (default 0.02)
  smoothing?: number          // lerp factor per frame (default 0.035 — itomdev value)
  lookIntensity?: number      // mouse look horizontal range in world units (default 4.0)
  glanceIntensity?: number    // door auto-glance strength (default 0.15)
  scrollEnabled?: boolean
}

export function useCorridorCamera({
  scrollSpeed = 0.02,
  smoothing = 0.035,
  lookIntensity = 4.0,
  glanceIntensity = 0.15,
  scrollEnabled = true,
}: UseCorridorCameraOptions = {}) {
  const { camera } = useThree()

  // Core camera state
  const targetZ   = useRef(10)   // where camera wants to be
  const currentZ  = useRef(10)   // where camera is (smoothed)
  const glance    = useRef(0)    // current auto-glance offset
  const targetGlance = useRef(0)

  // Mouse look (horizontal turn + subtle vertical)
  const look        = useRef({ x: 0, y: 0 })
  const targetLook  = useRef({ x: 0, y: 0 })

  // Scroll boundary: two door loops, second ends at z≈-175
  const MIN_Z = -190
  const MAX_Z = 12

  const scrollEnabledRef = useRef(scrollEnabled)
  useEffect(() => { scrollEnabledRef.current = scrollEnabled }, [scrollEnabled])

  // Wheel handler
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!scrollEnabledRef.current) return
    e.preventDefault()
    targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - e.deltaY * scrollSpeed))
  }, [scrollSpeed])

  // Keyboard handler
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
      targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - d * scrollSpeed))
    }
  }, [scrollSpeed])

  // Mouse move — maps cursor X to a wide horizontal look range
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1   // -1 (left) to +1 (right)
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    targetLook.current.x = nx * lookIntensity
    targetLook.current.y = -ny * 0.4
  }, [lookIntensity])

  // Touch for mobile scroll
  const touchStart = useRef({ y: 0 })
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current.y = e.touches[0].clientY
  }, [])
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!scrollEnabledRef.current) return
    const delta = (touchStart.current.y - e.touches[0].clientY) * scrollSpeed * 1.5
    targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - delta))
    touchStart.current.y = e.touches[0].clientY
  }, [scrollSpeed])

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [handleWheel, handleKeyDown, handleMouseMove, handleTouchStart, handleTouchMove])

  // Per-frame camera update
  useFrame(() => {
    if (!scrollEnabledRef.current) return

    // Smooth Z
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ.current, smoothing)

    // Smooth look
    look.current.x = THREE.MathUtils.lerp(look.current.x, targetLook.current.x, smoothing * 2)
    look.current.y = THREE.MathUtils.lerp(look.current.y, targetLook.current.y, smoothing * 2)

    // Auto-glance: compute target glance based on proximity to doors
    let bestStrength = 0
    let bestDir = 0
    const START_DIST = 15, PEAK_DIST = 8, END_DIST = -2
    for (const door of DOOR_POSITIONS) {
      const dist = currentZ.current - door.z
      let strength = 0
      if (dist > PEAK_DIST && dist < START_DIST) {
        strength = (START_DIST - dist) / (START_DIST - PEAK_DIST)
      } else if (dist <= PEAK_DIST && dist > END_DIST) {
        strength = (dist - END_DIST) / (PEAK_DIST - END_DIST)
      }
      if (strength > 0) {
        const eased = strength * (2 - strength)
        const dir = door.side === 'left' ? -1 : 1
        if (eased > bestStrength) { bestStrength = eased; bestDir = dir }
      }
    }
    targetGlance.current = bestDir * bestStrength * glanceIntensity * 3.5

    // Slow to glance, fast to release
    const releasing = Math.abs(targetGlance.current) < Math.abs(glance.current)
    glance.current = THREE.MathUtils.lerp(glance.current, targetGlance.current, releasing ? 0.08 : 0.03)

    // Apply to camera — position stays centered, look target drives the turn
    camera.position.z = currentZ.current
    camera.position.x = 0
    camera.position.y = 0.2 + look.current.y * 0.1

    // look.current.x is the primary horizontal aim; auto-glance adds on top
    const lookX = look.current.x + glance.current * 3
    camera.lookAt(lookX, 0.13 + look.current.y * 0.1, currentZ.current - 10)
  })

  return {
    getCameraZ: () => currentZ.current,
  }
}
