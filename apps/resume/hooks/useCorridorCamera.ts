'use client'

import { useRef, useEffect, useCallback } from 'react'
import { corridorKeyDelta } from '@/lib/lab/domain/corridor/keyboard'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { registerCorridorRail } from '@/lib/lab/app/camera/corridorRail'
import { hasExploredCorridor } from '@/lib/lab/domain/corridor/exploration'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import { nextTargetZ, nextLookX } from '@/lib/lab/touchControls'
import {
  CORRIDOR_DOORS,
  segmentIndexAtZ,
  segmentStartZ,
} from '@/lib/lab/domain/corridor/layout'

// 门的相对 Z 与侧墙来自 domain —— 原先这里自带一份拷贝（审计 B3）

const GLANCE_START_DIST = 15
const GLANCE_PEAK_DIST  = 8
const GLANCE_END_DIST   = -2

interface UseCorridorCameraOptions {
  scrollSpeed?:     number   // deltaY multiplier (default 0.02)
  smoothing?:       number   // lerp factor per frame (default 0.035)
  lookIntensity?:   number   // mouse look horizontal range in world units (default 4.0)
  glanceIntensity?: number   // door auto-glance strength (default 0.15)
  scrollEnabled?:   boolean
  /**
   * 相机沿走廊移动了一段距离后调一次（只调一次）。
   *
   * 判据在 `domain/corridor/exploration.ts`。放在这里而不是让调用方监听
   * `wheel` / `touchmove`：那样**键盘前进不算**，而键盘用户因此永远拿不到
   * `corridor_explore`，连带那条教程气泡永远关不掉（它只有被解锁才会消失）。
   */
  onExplored?:      () => void
}

export function useCorridorCamera({
  scrollSpeed    = 0.02,
  smoothing      = 0.035,
  lookIntensity  = 4.0,
  glanceIntensity = 0.15,
  scrollEnabled  = true,
  onExplored,
}: UseCorridorCameraOptions = {}) {
  const { camera } = useThree()

  /*
    回调用 ref 持有：调用方通常传内联箭头函数，identity 每次渲染都变。
    直接放进 `useFrame` 的闭包依赖会让整段每帧重建——而 `useFrame` 的回调
    本来就只注册一次。
  */
  const onExploredRef = useRef(onExplored)
  onExploredRef.current = onExplored

  const targetZ       = useRef(28)
  const currentZ      = useRef(28)
  /** 进走廊时的起点，用于算「探索位移」 */
  const startZRef     = useRef(28)
  const exploredRef   = useRef(false)

  /*
    把导轨登记到模块级注册表，让 `TeleportRoom` 能给它下命令。

    传送原先走 `cameraDirector.moveToWorld({ duration: 0 })`，而那在导演不持有
    相机时是**空操作**（`push()` 只写 controls 的内部球面坐标，位姿要等
    `update()` 才应用，而 `update()` 在非持有态直接 return）。
    详见 `lib/lab/app/camera/corridorRail.ts` 的说明。
  */
  useEffect(() => registerCorridorRail({
    jumpTo(z) {
      // 目标与当前值一起设：只设目标的话相机会平滑滑过去，而传送要的是瞬移
      targetZ.current = z
      currentZ.current = z
      // 传送本身就算"探索过了"——否则那条教程气泡会在落地后才弹出来
      exploredRef.current = true
      startZRef.current = z
    },
  }), [])
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

  /**
   * 键盘前进。
   *
   * 判断在 `domain/corridor/keyboard` 里（纯函数、可测）：焦点在可交互元素
   * 上时这次按键归控件，走廊不动也不 `preventDefault`。
   *
   * 原实现只排除 `INPUT` / `TEXTAREA`，于是 Lab 里所有按钮都没法用空格激活
   * ——键盘用户 Tab 到"打开地图"按空格，走廊往前走一步，地图没开（审计 E4）。
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!scrollEnabledRef.current) return
    const d = corridorKeyDelta(e.key, e.target as HTMLElement | null)
    if (d === null) return
    e.preventDefault()
    targetZ.current = targetZ.current - d * scrollSpeed
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

    /*
      「开始探索」的判定：按**位移**，不按输入事件类型。滚轮 / 触摸 / 键盘
      走同一条路径（见 domain/corridor/exploration.ts 的说明）。
    */
    if (!exploredRef.current && hasExploredCorridor(startZRef.current, currentZ.current)) {
      exploredRef.current = true
      onExploredRef.current?.()
    }

    // Smooth look
    look.current.x = THREE.MathUtils.lerp(look.current.x, targetLook.current.x, smoothing * 2)
    look.current.y = THREE.MathUtils.lerp(look.current.y, targetLook.current.y, smoothing * 2)

    // Auto-glance: compute the current segment, then check all doors in that segment
    // and the adjacent segments so glance transitions smoothly across segment boundaries.
    const cameraZ    = currentZ.current
    const currentSeg = segmentIndexAtZ(cameraZ)

    let bestStrength = 0
    let bestDir      = 0

    for (const segOffset of [-1, 0, 1]) {
      const seg   = currentSeg + segOffset
      if (seg < 0) continue
      const zBase = segmentStartZ(seg)

      for (const door of CORRIDOR_DOORS) {
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
