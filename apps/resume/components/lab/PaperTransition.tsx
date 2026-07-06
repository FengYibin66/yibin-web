'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface PaperTransitionProps {
  isOpen: boolean
  onClosed?: () => void
  onOpened?: () => void
}

export function PaperTransition({ isOpen, onClosed, onOpened }: PaperTransitionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (isOpen) {
      // Paper closes (covers screen)
      gsap.to(el, {
        scaleY: 1,
        transformOrigin: 'bottom center',
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: onClosed,
      })
    } else {
      // Paper opens (reveals)
      gsap.to(el, {
        scaleY: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        transformOrigin: 'top center',
        onComplete: onOpened,
      })
    }
  }, [isOpen, onClosed, onOpened])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f5f0e8',
        zIndex: 200,
        transform: 'scaleY(0)',
        transformOrigin: 'bottom center',
        pointerEvents: 'none',
      }}
    />
  )
}
