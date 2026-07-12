'use client'

import type { EducationEntry } from '@/lib/content/types'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ClassicBackLink } from './ClassicBackLink'

export function EducationDetailView({ edu }: { edu: EducationEntry }) {
  const { locale } = useLocale()
  const labels = content[locale].education

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <ClassicBackLink href="/classic/#education" />

      <div className="flex flex-wrap items-start gap-4 mb-8">
        {edu.logo ? (
          <img src={edu.logo} alt={edu.school} className="h-12 w-auto object-contain opacity-80" />
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {edu.degree} · {edu.field}
          </h1>
          <p className="mt-1" style={{ color: 'var(--accent-primary)' }}>
            {edu.school}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {edu.period}
            {edu.location ? ` · ${edu.location}` : ''}
            {edu.note ? ` · ${edu.note}` : ''}
          </p>
        </div>
        {edu.qsRank ? (
          <div
            className="rounded-xl text-center py-3 px-4"
            style={{
              background: 'linear-gradient(160deg, #00d4ff22, #6366f122)',
              border: '1px solid #00d4ff44',
            }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              {edu.qsLabel ?? 'QS'}
            </div>
            <div className="font-display font-bold text-3xl leading-none" style={{ color: 'var(--accent-primary)' }}>
              {edu.qsRank}
            </div>
          </div>
        ) : null}
      </div>

      {edu.keyModules && edu.keyModules.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {labels.keyModulesLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            {edu.keyModules.map((mod) => (
              <span
                key={mod}
                className="text-sm px-3 py-1.5 rounded-full border"
                style={{
                  color: 'var(--text-primary)',
                  borderColor: 'var(--bg-border)',
                  background: 'var(--bg-surface)',
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
