'use client'

import Link from 'next/link'
import type { ExperienceItem } from '../../lib/content/types'

interface TimelineItemProps {
  item: ExperienceItem
  index: number
  learnMoreLabel: string
}

export function TimelineItem({ item, index, learnMoreLabel }: TimelineItemProps) {
  const isEven = index % 2 === 0
  const detailHref = item.detail ? `/classic/experience/${item.id}/` : undefined

  const cardContent = (
    <div className="glass-card rounded-xl p-5">
      <div className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
        {item.role}
      </div>

      <div className="text-sm mt-1" style={{ color: 'var(--accent-primary)' }}>
        {item.company} &middot; {item.period}
      </div>

      <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
        {item.location}
      </div>

      <ul className="mt-3 space-y-1">
        {item.bullets.map((bullet, i) => (
          <li key={i} className="text-sm flex gap-1" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>›</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {item.images && item.images.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-hidden">
          {item.images.slice(0, 3).map((src, i) => (
            <div
              key={src}
              className="relative flex-1 h-24 rounded overflow-hidden"
              style={{
                transform: `rotate(${(i - 1) * 2}deg)`,
                zIndex: i,
              }}
            >
              <img
                src={src}
                alt={`Work photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {detailHref ? (
        <Link
          href={detailHref}
          className="inline-block mt-4 text-sm no-underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          {learnMoreLabel} →
        </Link>
      ) : null}
    </div>
  )

  return (
    <>
      <div className="md:hidden flex items-start gap-3 mb-6">
        <span
          className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: 'var(--accent-primary)' }}
        />
        <div className="flex-1">{cardContent}</div>
      </div>

      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center mb-8">
        {isEven ? cardContent : <div />}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#6366f1]" />
        </div>
        {!isEven ? cardContent : <div />}
      </div>
    </>
  )
}
