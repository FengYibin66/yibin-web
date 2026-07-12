'use client'

import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, StatCard } from '@/components/ui'

export function AboutSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="about" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={c.about.title} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="flex flex-col items-center md:items-start gap-8">
            <img
              src="/avatar.jpg"
              alt="Yibin Feng"
              className="w-40 h-40 rounded-full object-cover ring-2 ring-[#00d4ff] ring-offset-2 ring-offset-[#070b12]"
            />
            <div className="animate-in grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-4 w-full">
              {c.about.stats.map((stat) => (
                <StatCard key={stat.label} value={stat.value} label={stat.label} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="animate-in space-y-4">
              {c.about.bio.map((para, i) => (
                <p key={i} className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {para}
                </p>
              ))}
            </div>

            <div className="space-y-3">
              {c.about.education.map((edu) => (
                <Link
                  key={edu.id}
                  href={`/classic/education/${edu.id}/`}
                  className="glass-card edu-card rounded-lg px-4 py-3 block no-underline"
                >
                  <div className="flex items-center gap-3">
                    {edu.logo && (
                      <img
                        src={edu.logo}
                        alt={edu.school}
                        className="h-8 w-auto object-contain flex-shrink-0 opacity-75"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-display font-semibold text-sm truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {edu.degree} · {edu.field}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {edu.school}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono" style={{ color: 'var(--accent-primary)' }}>
                        {edu.period}
                      </div>
                      {edu.note && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {edu.note}
                        </div>
                      )}
                      <div className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                        {c.about.viewEducationLabel} →
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
