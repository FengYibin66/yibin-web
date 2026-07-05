'use client'

import { cn } from '../../lib/utils'
import type { ExperienceItem } from '../../lib/content/types'

interface TimelineItemProps {
  item: ExperienceItem
  index: number
}

export function TimelineItem({ item, index }: TimelineItemProps) {
  const isEven = index % 2 === 0

  return (
    <div className="relative flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center">
      {/* Card */}
      <div
        className={cn(
          'flex-1 rounded-xl p-5 border',
          isEven ? 'md:text-right' : 'md:order-2',
        )}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
      >
        {/* Role */}
        <div
          className="font-display font-bold text-lg"
          style={{ color: 'var(--text-primary)' }}
        >
          {item.role}
        </div>

        {/* Company + Period */}
        <div className="text-sm mt-1" style={{ color: 'var(--accent-primary)' }}>
          {item.company} &middot; {item.period}
        </div>

        {/* Location */}
        <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {item.location}
        </div>

        {/* Bullet list */}
        <ul className="mt-3 space-y-1">
          {item.bullets.map((bullet, i) => (
            <li
              key={i}
              className={cn('text-sm flex gap-1', isEven ? 'md:flex-row-reverse' : '')}
              style={{ color: 'var(--text-secondary)' }}
            >
              <span style={{ color: '#00d4ff', flexShrink: 0 }}>›</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Center dot */}
      <div className="hidden md:flex flex-shrink-0 w-4 h-4 rounded-full border-2 border-[#00d4ff] bg-[#0d1220] z-10" />

      {/* Spacer for odd items on desktop (pushes card right) */}
      {!isEven && <div className="hidden md:block flex-1 md:order-1" />}
    </div>
  )
}
