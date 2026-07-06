'use client'

import type { PublicationItem } from '../../lib/content/types'
import { cn } from '../../lib/utils'

interface PublicationCardProps {
  item: PublicationItem
  featured?: boolean
}

export function PublicationCard({ item, featured = false }: PublicationCardProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-xl p-5',
        featured ? 'ring-2 ring-[#00d4ff]/40' : 'ring-1 ring-[#6366f1]/20',
      )}
      style={featured ? {
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.08)',
          '0 8px 32px rgba(0,0,0,0.45)',
          '0 1px 2px rgba(0,0,0,0.6)',
          '0 0 40px rgba(99,102,241,0.1)',
        ].join(', ')
      } : undefined}
    >
      {featured && item.image && (
        <div className="relative h-44 overflow-hidden rounded-t-lg -mx-5 -mt-5 mb-4">
          <img
            src={item.image}
            alt="Publication poster"
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
          <div className="scan-line absolute inset-0 pointer-events-none" />
        </div>
      )}

      {/* Venue label */}
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--accent-primary)' }}
      >
        {item.venue} {item.year}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-display font-bold leading-snug mb-2',
          featured ? 'text-lg' : 'text-base',
        )}
        style={{ color: 'var(--text-primary)' }}
      >
        {item.title}
      </h3>

      {/* Authors */}
      <p
        className="text-sm truncate mb-2"
        style={{ color: 'var(--text-secondary)' }}
        title={item.authors}
      >
        {item.authors}
      </p>

      {/* Abstract (featured only) */}
      {featured && item.abstract && (
        <p
          className="text-sm mb-3 line-clamp-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          {item.abstract}
        </p>
      )}

      {/* Keywords */}
      {item.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.keywords.map((kw) => (
            <span
              key={kw}
              className="text-xs px-2 py-0.5 rounded border"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--bg-border)',
                background: 'var(--bg-base, #08101e)',
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* DOI link */}
      {item.doi && (
        <a
          href={item.doi}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          View Publication →
        </a>
      )}
    </div>
  )
}
