'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, PublicationCard } from '@/components/ui'

export function PublicationsSection() {
  const { locale } = useLocale()
  const c = content[locale]

  const featured = c.publications.items.find((item) => item.featured === true)
  const secondary = c.publications.items.filter((item) => item.featured !== true)

  return (
    <section id="publications" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
      <SectionTitle title={c.publications.title} />

      <div className="space-y-6">
        {featured && (
          <div className="publication-card">
            <PublicationCard item={featured} featured={true} />
          </div>
        )}

        {secondary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secondary.map((item) => (
              <div key={item.title} className="publication-card">
                <PublicationCard item={item} featured={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </section>
  )
}
