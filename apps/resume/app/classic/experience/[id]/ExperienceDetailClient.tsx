'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ExperienceDetailView } from '@/components/classic/ExperienceDetailView'

export function ExperienceDetailClient({ id }: { id: string }) {
  const { locale } = useLocale()
  const item = content[locale].experience.items.find((e) => e.id === id)

  if (!item) {
    return (
      <div className="px-6 py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
        Not found
      </div>
    )
  }

  return <ExperienceDetailView item={item} />
}
