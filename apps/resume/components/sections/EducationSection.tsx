'use client'

import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle } from '@/components/ui'

export function EducationSection() {
  const { locale } = useLocale()
  const edu = content[locale].education

  return (
    <section id="education" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={edu.title} />
        {edu.subtitle ? (
          <p className="mb-10 -mt-4 max-w-2xl text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            {edu.subtitle}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {edu.items.map((item) => (
            <Link
              key={item.id}
              href={`/classic/education/${item.id}/`}
              className="glass-card rounded-xl p-5 block no-underline group transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                {item.qsRank ? (
                  <div
                    className="flex-shrink-0 w-[72px] rounded-xl text-center py-3 px-2"
                    style={{
                      background: 'linear-gradient(160deg, #00d4ff22, #6366f122)',
                      border: '1px solid #00d4ff44',
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {item.qsLabel ?? 'QS'}
                    </div>
                    <div className="font-display font-bold text-2xl leading-none" style={{ color: 'var(--accent-primary)' }}>
                      {item.qsRank}
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex-shrink-0 w-[72px] h-[72px] rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bg-border)' }}
                  >
                    {item.logo ? (
                      <img src={item.logo} alt="" className="h-10 w-auto object-contain opacity-80" loading="lazy" />
                    ) : null}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.logo && item.qsRank ? (
                          <img
                            src={item.logo}
                            alt=""
                            className="h-6 w-auto object-contain opacity-75"
                            loading="lazy"
                          />
                        ) : null}
                        <h3
                          className="font-display font-bold text-base truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.school}
                        </h3>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--accent-primary)' }}>
                        {item.degree} · {item.field}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {item.period}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                      {item.note ? (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className="text-xs mt-3 font-medium opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {edu.viewEducationLabel} →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
