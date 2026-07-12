'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { EducationDetailView } from '@/components/classic/EducationDetailView'

export function EducationDetailClient({ id }: { id: string }) {
  const { locale } = useLocale()
  const edu = content[locale].about.education.find((e) => e.id === id)

  if (!edu) {
    return (
      <div className="px-6 py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
        Not found
      </div>
    )
  }

  return <EducationDetailView edu={edu} />
}
