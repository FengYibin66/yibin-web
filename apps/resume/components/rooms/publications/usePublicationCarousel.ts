'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
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
  captureTarget: Element
  direction: DragDirection
  captured: boolean
}

interface ActiveTween {
  tween: gsap.core.Tween
  resolve: () => void
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
  const currentScroll = useRef(0)
  const targetScroll = useRef(0)
  const optionsRef = useRef(options)
  const enabledRef = useRef(options.active && !options.locked)
  const mountedRef = useRef(true)
  const dragRef = useRef<DragState | null>(null)
  const activeTweenRef = useRef<ActiveTween | null>(null)

  optionsRef.current = options
  enabledRef.current = options.active && !options.locked

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const cancelActiveTween = useCallback((): void => {
    const activeTween = activeTweenRef.current
    if (!activeTween) {
      return
    }

    activeTweenRef.current = null
    activeTween.tween.kill()
    activeTween.resolve()
  }, [])

  const clearDrag = useCallback((releaseCapture: boolean): void => {
    const drag = dragRef.current
    dragRef.current = null
    if (
      !drag ||
      !releaseCapture ||
      !drag.captured ||
      !drag.captureTarget.hasPointerCapture(drag.pointerId)
    ) {
      return
    }
    drag.captureTarget.releasePointerCapture(drag.pointerId)
  }, [])

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
        const tween = gsap.to(targetScroll, {
          current: centeredTarget,
          duration: CENTER_DURATION_SECONDS,
          ease: 'power2.inOut',
          onComplete: () => {
            if (activeTweenRef.current?.tween !== tween) {
              return
            }
            activeTweenRef.current = null
            targetScroll.current = centeredTarget
            currentScroll.current = centeredTarget
            resolve()
          },
        })
        activeTweenRef.current = { tween, resolve }
      })
    },
    [cancelActiveTween],
  )

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
    if (options.active && !options.locked) {
      router.activate(WHEEL_CONSUMER_ID)
      return
    }
    router.deactivate(WHEEL_CONSUMER_ID)
    clearDrag(true)
  }, [clearDrag, options.active, options.locked, router])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (
        !mountedRef.current ||
        !enabledRef.current ||
        !isTouchLikePointer(event)
      ) {
        return
      }
      const captureTarget = event.target
      if (!(captureTarget instanceof Element)) {
        return
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastTouchX: event.clientX,
        captureTarget,
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
        drag.direction = getLockedDirection(drag, event)
        if (drag.direction === 'horizontal') {
          drag.captureTarget.setPointerCapture(drag.pointerId)
          drag.captured = true
        }
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

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    window.addEventListener('lostpointercapture', handlePointerEnd)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
      window.removeEventListener('lostpointercapture', handlePointerEnd)
      clearDrag(true)
    }
  }, [clearDrag])

  useEffect(() => cancelActiveTween, [cancelActiveTween])

  return useMemo(
    () => ({ currentScroll, centerItem }),
    [centerItem],
  )
}
