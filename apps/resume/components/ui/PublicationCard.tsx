'use client'

import Link from 'next/link'
import type { PublicationItem } from '../../lib/content/types'
import { cn } from '../../lib/utils'
import { ImagePreview } from './ImagePreview'

interface PublicationCardProps {
  item: PublicationItem
  featured?: boolean
  readLabel: string
  citationsLabel: string
  firstAuthorLabel: string
}

export function PublicationCard({
  item,
  featured = false,
  readLabel,
  citationsLabel,
  firstAuthorLabel,
}: PublicationCardProps) {
  const href = `/classic/publications/${item.id}/`

  return (
    <Link
      href={href}
      className={cn(
        'group glass-card rounded-xl overflow-hidden block no-underline h-full transition-transform duration-200 hover:-translate-y-0.5',
        featured ? 'ring-2 ring-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] md:grid md:grid-cols-[1.1fr_1fr]' : 'ring-1 ring-[color-mix(in_srgb,var(--bg-border)_80%,transparent)]',
      )}
    >
      {item.image ? (
        <div
          className={cn(
            'relative overflow-hidden publication-cover',
            featured ? 'aspect-[16/10] md:aspect-auto md:min-h-[280px]' : 'aspect-[16/10]',
          )}
          style={{ background: 'var(--bg-elevated)' }}
        >
          <ImagePreview
            src={item.image}
            alt={item.title}
            className="absolute inset-0 h-full w-full"
            imgClassName={cn(
              'transition-transform duration-500 group-hover:scale-[1.02]',
              featured ? 'object-contain md:object-cover md:object-left' : 'object-contain',
            )}
            rounded="rounded-none"
          />
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            {item.role === 'first' ? (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: '#00d4ff22', color: 'var(--accent-primary)', border: '1px solid #00d4ff55' }}
              >
                {firstAuthorLabel}
              </span>
            ) : null}
            {typeof item.citations === 'number' && item.citations > 0 ? (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--bg-base) 75%, transparent)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--bg-border)',
                }}
              >
                {citationsLabel} {item.citations}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn('p-5', featured && 'md:flex md:flex-col md:justify-center md:p-7')}
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--accent-primary)' }}
        >
          {item.venue} · {item.year}
        </div>

        <h3
          className={cn(
            'font-display font-bold leading-snug mb-2',
            featured ? 'text-lg md:text-2xl' : 'text-base',
          )}
          style={{ color: 'var(--text-primary)' }}
        >
          {item.title}
        </h3>

        <p
          className="text-sm mb-3 line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
          title={item.authors}
        >
          {item.authors}
        </p>

        {item.takeaway ? (
          <p
            className={cn('text-sm mb-4 leading-relaxed', featured ? 'line-clamp-4' : 'line-clamp-3')}
            style={{ color: 'var(--text-secondary)' }}
          >
            {item.takeaway}
          </p>
        ) : null}

        {item.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.keywords.slice(0, featured ? 5 : 4).map((kw) => (
              <span
                key={kw}
                className="text-xs px-2 py-0.5 rounded-full border"
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--bg-border)',
                  background: 'var(--bg-elevated)',
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        ) : null}

        <span
          className="inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--accent-primary)' }}
        >
          {readLabel} →
        </span>
      </div>
    </Link>
  )
}
