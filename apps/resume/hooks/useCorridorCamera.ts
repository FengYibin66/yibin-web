'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Door Z positions and which side they're on (for auto-glance)
const DOOR_POSITIONS = [
  { z: -18, side: 'left'  },  // About
  { z: -32, side: 'right' },  // Projects
  { z: -48, side: 'left'  },  // Publications
  { z: -62, side: 'right' },  // Gallery
  { z: -75, side: 'left'  },  // Contact
] as const

interface UseCorridorCameraOptions {
  scrollSpeed?: number        // deltaY multiplier (default 0.02)
  smoothing?: number          // lerp factor per frame (default 0.035 — itomdev value)
  parallaxIntensity?: number  // mouse parallax strength (default 0.3)
  glanceIntensity?: number    // door auto-glance strength (default 0.15)
  scrollEnabled?: boolean
}

export function useCorridorCamera({
  scrollSpeed = 0.02,
  smoothing = 0.035,
  parallaxIntensity = 0.3,
  glanceIntensity = 0.15,
  scrollEnabled = true,
}: UseCorridorCameraOptions = {}) {
  const { camera } = useThree()

  // Core camera state
  const targetZ   = useRef(10)   // where camera wants to be
  const currentZ  = useRef(10)   // where camera is (smoothed)
  const glance    = useRef(0)    // current auto-glance offset
  const targetGlance = useRef(0)

  // Mouse parallax
  const parallax  = useRef({ x: 0, y: 0 })
  const targetParallax = useRef({ x: 0, y: 0 })

  // Scroll boundary: don't go past last door
  const MIN_Z = -90
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

  // Mouse move for parallax
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    targetParallax.current.x = nx * parallaxIntensity
    targetParallax.current.y = -ny * parallaxIntensity * 0.5
  }, [parallaxIntensity])

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

    // Smooth parallax
    parallax.current.x = THREE.MathUtils.lerp(parallax.current.x, targetParallax.current.x, smoothing * 0.8)
    parallax.current.y = THREE.MathUtils.lerp(parallax.current.y, targetParallax.current.y, smoothing * 0.8)

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

    // Apply to camera
    camera.position.z = currentZ.current
    camera.position.x = parallax.current.x
    camera.position.y = 0.2 + parallax.current.y

    const lookX = parallax.current.x * 0.3 + glance.current * 3
    camera.lookAt(lookX, 0.13 + parallax.current.y, currentZ.current - 10)
  })

  return {
    getCameraZ: () => currentZ.current,
  }
}
