'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import gsap from 'gsap'
import { cn } from '../../lib/utils'

interface GlowButtonProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary'
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-colors duration-200 cursor-pointer border'

const variantClasses: Record<'primary' | 'secondary', string> = {
  primary:
    'bg-gradient-to-r from-[#00d4ff] to-[#6366f1] border-transparent text-[#0d1220] hover:shadow-[0_0_20px_#00d4ff55] hover:opacity-90',
  secondary:
    'bg-transparent border-[#00d4ff55] text-[#8b9bbc] hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_16px_#00d4ff33]',
}

// Magnetic pull radius in pixels
const MAGNETIC_RADIUS = 80
const PULL_STRENGTH = 0.4

function useMagneticEffect(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    // Only on devices with precise pointer (mouse), not touch
    if (!window.matchMedia('(pointer: fine)').matches) return

    const el = ref.current
    if (!el) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)

      if (dist < MAGNETIC_RADIUS) {
        gsap.to(el, {
          x: dx * PULL_STRENGTH,
          y: dy * PULL_STRENGTH,
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      }
    }

    const handleMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.4)',
        overwrite: 'auto',
      })
    }

    // Listen on document to catch approach before mouseenter
    document.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
      gsap.killTweensOf(el)
    }
  }, [ref])
}

export function GlowButton({ children, href, onClick, className, variant = 'secondary' }: GlowButtonProps) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null)
  useMagneticEffect(ref)

  const classes = cn(baseClasses, variantClasses[variant], className)

  if (href) {
    const isExternal = href.startsWith('http')
    return (
      <a
        ref={ref}
        href={href}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={classes}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  return (
    <button ref={ref} type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  )
}
