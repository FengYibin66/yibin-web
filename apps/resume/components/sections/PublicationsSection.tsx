'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, PublicationCard } from '@/components/ui'

export function PublicationsSection() {
  const { locale } = useLocale()
  const c = content[locale].publications

  const featured = c.items.find((item) => item.featured === true)
  const secondary = c.items.filter((item) => item.featured !== true)

  return (
    <section
      id="publications"
      className="relative z-10 w-full"
      style={{ background: 'var(--bg-surface)', isolation: 'isolate' }}
    >
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
          <SectionTitle title={c.title} />
          <div className="flex flex-wrap items-center gap-4 pb-2 md:pb-8">
            {c.stats ? (
              <div className="flex gap-4 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                <span>{c.citationsLabel} {c.stats.citations}</span>
                <span>h-index {c.stats.hIndex}</span>
                <span>i10 {c.stats.i10}</span>
              </div>
            ) : null}
            <a
              href={c.scholarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium no-underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              {c.scholarLabel} →
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {featured ? (
            <div className="publication-card">
              <PublicationCard
                item={featured}
                featured
                readLabel={c.readHighlightsLabel}
                citationsLabel={c.citationsLabel}
                firstAuthorLabel={c.firstAuthorLabel}
              />
            </div>
          ) : null}

          {secondary.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {secondary.map((item) => (
                <div key={item.id} className="publication-card">
                  <PublicationCard
                    item={item}
                    featured={false}
                    readLabel={c.readHighlightsLabel}
                    citationsLabel={c.citationsLabel}
                    firstAuthorLabel={c.firstAuthorLabel}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
