'use client'

import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface GlowButtonProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary'
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200 cursor-pointer border'

const variantClasses: Record<'primary' | 'secondary', string> = {
  primary:
    'bg-gradient-to-r from-[#00d4ff] to-[#6366f1] border-transparent text-[#0d1220] hover:shadow-[0_0_20px_#00d4ff55] hover:opacity-90',
  secondary:
    'bg-transparent border-[#00d4ff55] text-[#8b9bbc] hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_16px_#00d4ff33]',
}

export function GlowButton({
  children,
  href,
  onClick,
  className,
  variant = 'secondary',
}: GlowButtonProps) {
  const classes = cn(baseClasses, variantClasses[variant], className)

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  )
}
