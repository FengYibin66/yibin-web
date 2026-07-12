'use client'

import Link from 'next/link'
import type { ExperienceItem } from '../../lib/content/types'
import { ImagePreview } from './ImagePreview'

interface TimelineItemProps {
  item: ExperienceItem
  index: number
  learnMoreLabel: string
}

export function TimelineItem({ item, index, learnMoreLabel }: TimelineItemProps) {
  const isEven = index % 2 === 0
  const detailHref = item.detail ? `/classic/experience/${item.id}/` : undefined

  const cardContent = (
    <div className="glass-card rounded-xl overflow-hidden">
      {item.coverImage ? (
        <ImagePreview
          src={item.coverImage}
          alt={item.coverAlt ?? item.company}
          caption={item.company}
          className="aspect-[16/9] w-full"
          imgClassName="object-cover object-top"
          rounded="rounded-none"
        />
      ) : null}

      <div className="p-5">
        <div className="flex items-start gap-3">
          {item.logo ? (
            <img
              src={item.logo}
              alt=""
              className="h-10 w-10 rounded-lg object-contain flex-shrink-0 mt-0.5 p-1"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
              }}
              loading="lazy"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {item.role}
            </div>

            <div className="text-sm mt-1" style={{ color: 'var(--accent-primary)' }}>
              {item.companyUrl ? (
                <a
                  href={item.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline hover:underline"
                  style={{ color: 'var(--accent-primary)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.company}
                </a>
              ) : (
                item.company
              )}
              {' · '}
              {item.period}
            </div>
          </div>
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

        {item.images && item.images.filter((src) => src !== item.coverImage).length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {item.images
              .filter((src) => src !== item.coverImage)
              .slice(0, 3)
              .map((src) => (
              <ImagePreview
                key={src}
                src={src}
                alt={item.company}
                className="aspect-square"
                imgClassName="object-cover"
                rounded="rounded-md"
              />
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
    </div>
  )

  return (
    <>
      <div className="md:hidden flex items-start gap-3 mb-6">
        <span
          className="mt-2 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: 'var(--accent-primary)' }}
        />
        <div className="flex-1 min-w-0">{cardContent}</div>
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
