'use client'

import type { EducationEntry } from '@/lib/content/types'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ClassicBackLink } from './ClassicBackLink'

export function EducationDetailView({ edu }: { edu: EducationEntry }) {
  const { locale } = useLocale()
  const label = content[locale].about.keyModulesLabel

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <ClassicBackLink href="/classic/#about" />

      <div className="flex items-center gap-4 mb-6">
        {edu.logo ? (
          <img src={edu.logo} alt={edu.school} className="h-12 w-auto object-contain opacity-80" />
        ) : null}
        <div>
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {edu.degree} · {edu.field}
          </h1>
          <p className="mt-1" style={{ color: 'var(--accent-primary)' }}>
            {edu.school}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {edu.period}
            {edu.note ? ` · ${edu.note}` : ''}
          </p>
        </div>
      </div>

      {edu.keyModules && edu.keyModules.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {label}
          </h2>
          <div className="flex flex-wrap gap-2">
            {edu.keyModules.map((mod) => (
              <span
                key={mod}
                className="text-sm px-3 py-1.5 rounded-full border"
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--bg-border)',
                  background: 'var(--bg-elevated, transparent)',
                }}
              >
                {mod}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
