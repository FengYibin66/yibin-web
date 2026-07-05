'use client'

import { cn } from '../../lib/utils'

interface SectionTitleProps {
  title: string
  className?: string
}

export function SectionTitle({ title, className }: SectionTitleProps) {
  return (
    <div className={cn('mb-8', className)}>
      <h2
        className="section-title-text font-display text-3xl md:text-4xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h2>
      <div className="mt-2 h-0.5 w-16 bg-gradient-to-r from-[#00d4ff] to-[#6366f1]" />
    </div>
  )
}
