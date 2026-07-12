'use client'

import Link from 'next/link'
import type { PublicationItem } from '@/lib/content/types'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ImagePreview } from '@/components/ui'
import { ClassicBackLink } from './ClassicBackLink'

export function PublicationDetailView({ item }: { item: PublicationItem }) {
  const { locale } = useLocale()
  const labels = content[locale].publications

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <ClassicBackLink href="/classic/#publications" />

      {item.image ? (
        <ImagePreview
          src={item.image}
          alt={item.title}
          caption={item.title}
          className="mb-8 w-full border bg-[var(--bg-elevated)]"
          imgClassName="max-h-[420px] object-contain"
          rounded="rounded-2xl"
        />
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {item.role === 'first' ? (
          <span
            className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: '#00d4ff22', color: 'var(--accent-primary)', border: '1px solid #00d4ff55' }}
          >
            {labels.firstAuthorLabel}
          </span>
        ) : null}
        {typeof item.citations === 'number' && item.citations > 0 ? (
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-full"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
          >
            {labels.citationsLabel} {item.citations}
          </span>
        ) : null}
      </div>

      <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-primary)' }}>
        {item.venue} · {item.year}
      </p>

      <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: 'var(--text-primary)' }}>
        {item.title}
      </h1>

      <p className="text-base mb-6" style={{ color: 'var(--text-secondary)' }}>
        {item.authors}
      </p>

      {item.abstract ? (
        <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
          {item.abstract}
        </p>
      ) : null}

      {item.highlights && item.highlights.length > 0 ? (
        <section className="mb-10">
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {labels.readHighlightsLabel}
          </h2>
          <ul className="space-y-3">
            {item.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>›</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-10">
          {item.keywords.map((kw) => (
            <span
              key={kw}
              className="text-xs px-2.5 py-1 rounded-full border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--bg-border)' }}
            >
              {kw}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {(item.links ?? []).map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full px-4 py-2 text-sm no-underline border transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-primary)', borderColor: '#00d4ff55', background: '#00d4ff11' }}
          >
            {link.label} →
          </a>
        ))}
        <a
          href={labels.scholarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full px-4 py-2 text-sm no-underline border transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--bg-border)' }}
        >
          {labels.scholarLabel} →
        </a>
        <Link
          href="/classic/#publications"
          className="inline-flex items-center rounded-full px-4 py-2 text-sm no-underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← {content[locale].classicUi.backToClassic}
        </Link>
      </div>
    </div>
  )
}
