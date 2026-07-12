'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { PublicationDetailView } from '@/components/classic/PublicationDetailView'

export function PublicationDetailClient({ id }: { id: string }) {
  const { locale } = useLocale()
  const item = content[locale].publications.items.find((p) => p.id === id)

  if (!item) {
    return (
      <div className="px-6 py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
        Not found
      </div>
    )
  }

  return <PublicationDetailView item={item} />
}
