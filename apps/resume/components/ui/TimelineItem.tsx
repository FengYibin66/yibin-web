'use client'

import type { ExperienceItem } from '../../lib/content/types'

interface TimelineItemProps {
  item: ExperienceItem
  index: number
}

export function TimelineItem({ item, index }: TimelineItemProps) {
  const isEven = index % 2 === 0

  // Card content shared between even/odd slots
  const cardContent = (
    <div
      className="rounded-xl p-5 border"
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
            className="text-sm flex gap-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>›</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <>
      {/* Mobile layout: dot bullet + card stacked */}
      <div className="md:hidden flex items-start gap-3 mb-6">
        <span
          className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: 'var(--accent-primary)' }}
        />
        <div className="flex-1">{cardContent}</div>
      </div>

      {/* Desktop: 3-column grid [1fr, auto, 1fr] — card | dot | card
          Even index (0, 2...): card in col 1, dot in col 2, empty in col 3
          Odd index (1, 3...): empty in col 1, dot in col 2, card in col 3 */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center mb-8">
        {/* Left slot */}
        {isEven ? cardContent : <div />}

        {/* Center dot */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#6366f1]" />
        </div>

        {/* Right slot */}
        {!isEven ? cardContent : <div />}
      </div>
    </>
  )
}
