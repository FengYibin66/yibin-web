'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import {
  PUBLICATION_CAROUSEL_LERP_SPEED,
  PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
} from './publicationConstants'
import {
  applyCarouselDelta,
  getNearestCarouselTarget,
} from './publicationCarouselMath'

const WHEEL_CONSUMER_ID = 'room:publications'
const TOUCH_DRAG_SENSITIVITY = 0.008
const DIRECTION_LOCK_THRESHOLD = 6
const CENTER_DURATION_SECONDS = 0.5

type DragDirection = 'pending' | 'horizontal' | 'vertical'

interface DragState {
  pointerId: number
  startX: number
  startY: number
  lastTouchX: number
  captureTarget: HTMLCanvasElement
  direction: DragDirection
  captured: boolean
}

interface ActiveTween {
  tween: gsap.core.Tween | null
  resolve: () => void
  settled: boolean
}

export interface UsePublicationCarouselOptions {
  active: boolean
  locked: boolean
  itemCount: number
  itemGap: number
}

export interface PublicationCarouselApi {
  currentScroll: MutableRefObject<number>
  centerItem: (index: number) => Promise<void>
}

function isTouchLikePointer(event: PointerEvent): boolean {
  return (
    event.isPrimary &&
    event.button === 0 &&
    (event.pointerType === 'touch' || event.pointerType === 'pen')
  )
}

function getLockedDirection(
  drag: DragState,
  event: PointerEvent,
): DragDirection {
  const deltaX = Math.abs(event.clientX - drag.startX)
  const deltaY = Math.abs(event.clientY - drag.startY)
  if (Math.max(deltaX, deltaY) < DIRECTION_LOCK_THRESHOLD) {
    return 'pending'
  }
  return deltaX > deltaY ? 'horizontal' : 'vertical'
}

export function usePublicationCarousel(
  options: UsePublicationCarouselOptions,
): PublicationCarouselApi {
  const router = useWheelRouter()
  const pointerTarget = useThree(state => state.gl.domElement)
  const currentScroll = useRef(0)
  const targetScroll = useRef(0)
  const optionsRef = useRef(options)
  const previousOptionsRef = useRef(options)
  const enabledRef = useRef(options.active && !options.locked)
  const mountedRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const activeTweenRef = useRef<ActiveTween | null>(null)

  optionsRef.current = options
  enabledRef.current = options.active && !options.locked

  const settleTween = useCallback((
    activeTween: ActiveTween,
    syncCurrent: boolean,
  ): void => {
    if (activeTween.settled) {
      return
    }
    activeTween.settled = true
    if (activeTweenRef.current === activeTween) {
      activeTweenRef.current = null
    }
    if (syncCurrent && mountedRef.current) {
      currentScroll.current = targetScroll.current
    }
    activeTween.resolve()
  }, [])

  const clearDrag = useCallback((releaseCapture: boolean): void => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !releaseCapture || !drag.captured) {
      return
    }
    try {
      if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
        drag.captureTarget.releasePointerCapture(drag.pointerId)
      }
    } catch {
      // Capture may already be gone when the browser dispatches cancellation.
    }
  }, [])

  const cancelActiveTween = useCallback((): void => {
    const activeTween = activeTweenRef.current
    if (!activeTween) {
      return
    }

    activeTweenRef.current = null
    activeTween.tween?.kill()
    settleTween(activeTween, false)
    targetScroll.current = currentScroll.current
  }, [settleTween])

  const centerItem = useCallback(
    (index: number): Promise<void> => {
      let centeredTarget: number
      try {
        centeredTarget = getNearestCarouselTarget(
          currentScroll.current,
          index,
          optionsRef.current.itemGap,
          optionsRef.current.itemCount,
        )
      } catch (error) {
        return Promise.reject(error)
      }

      cancelActiveTween()
      return new Promise(resolve => {
        const activeTween: ActiveTween = {
          tween: null,
          resolve,
          settled: false,
        }
        activeTweenRef.current = activeTween
        activeTween.tween = gsap.to(targetScroll, {
          current: centeredTarget,
          duration: CENTER_DURATION_SECONDS,
          ease: 'power2.inOut',
          onComplete: () => {
            if (activeTween.settled) {
              return
            }
            targetScroll.current = centeredTarget
            settleTween(activeTween, true)
          },
          onInterrupt: () => settleTween(activeTween, false),
        })
      })
    },
    [cancelActiveTween, settleTween],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearDrag(true)
      cancelActiveTween()
    }
  }, [cancelActiveTween, clearDrag])

  useFrame((_, delta) => {
    if (!mountedRef.current || !Number.isFinite(delta) || delta <= 0) {
      return
    }
    const alpha = 1 - Math.exp(-delta * PUBLICATION_CAROUSEL_LERP_SPEED)
    currentScroll.current +=
      (targetScroll.current - currentScroll.current) * alpha
  })

  useEffect(() => {
    const unsubscribe = router.subscribe(WHEEL_CONSUMER_ID, event => {
      if (!mountedRef.current || !enabledRef.current) {
        return
      }
      targetScroll.current = applyCarouselDelta(
        targetScroll.current,
        event.deltaY,
        PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
      )
    })

    return () => {
      unsubscribe()
      router.deactivate(WHEEL_CONSUMER_ID)
    }
  }, [router])

  useEffect(() => {
    const previousOptions = previousOptionsRef.current
    const geometryChanged =
      previousOptions.itemCount !== options.itemCount ||
      previousOptions.itemGap !== options.itemGap
    previousOptionsRef.current = options

    if (!options.active || options.locked || geometryChanged) {
      cancelActiveTween()
      clearDrag(true)
    }
    if (options.active && !options.locked) {
      router.activate(WHEEL_CONSUMER_ID)
      return
    }
    router.deactivate(WHEEL_CONSUMER_ID)
  }, [
    cancelActiveTween,
    clearDrag,
    options.active,
    options.itemCount,
    options.itemGap,
    options.locked,
    router,
  ])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (
        !mountedRef.current ||
        !enabledRef.current ||
        !isTouchLikePointer(event)
      ) {
        return
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastTouchX: event.clientX,
        captureTarget: pointerTarget,
        direction: 'pending',
        captured: false,
      }
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!enabledRef.current || !drag || event.pointerId !== drag.pointerId) {
        return
      }
      if (drag.direction === 'pending') {
        const lockedDirection = getLockedDirection(drag, event)
        if (lockedDirection === 'horizontal') {
          try {
            drag.captureTarget.setPointerCapture(drag.pointerId)
          } catch {
            dragRef.current = null
            return
          }
          drag.captured = true
        }
        drag.direction = lockedDirection
      }
      if (drag.direction !== 'horizontal') {
        return
      }

      event.preventDefault()
      targetScroll.current = applyCarouselDelta(
        targetScroll.current,
        drag.lastTouchX - event.clientX,
        TOUCH_DRAG_SENSITIVITY,
      )
      drag.lastTouchX = event.clientX
    }

    const handlePointerEnd = (event: PointerEvent): void => {
      if (event.pointerId === dragRef.current?.pointerId) {
        clearDrag(event.type !== 'lostpointercapture')
      }
    }

    pointerTarget.addEventListener('pointerdown', handlePointerDown)
    pointerTarget.addEventListener('pointermove', handlePointerMove, {
      passive: false,
    })
    pointerTarget.addEventListener('pointerup', handlePointerEnd)
    pointerTarget.addEventListener('pointercancel', handlePointerEnd)
    pointerTarget.addEventListener('lostpointercapture', handlePointerEnd)
    return () => {
      pointerTarget.removeEventListener('pointerdown', handlePointerDown)
      pointerTarget.removeEventListener('pointermove', handlePointerMove)
      pointerTarget.removeEventListener('pointerup', handlePointerEnd)
      pointerTarget.removeEventListener('pointercancel', handlePointerEnd)
      pointerTarget.removeEventListener('lostpointercapture', handlePointerEnd)
      clearDrag(true)
    }
  }, [clearDrag, pointerTarget])

  return useMemo(
    () => ({ currentScroll, centerItem }),
    [centerItem],
  )
}
