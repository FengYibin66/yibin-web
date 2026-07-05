'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, SkillBadge } from '@/components/ui'

export function SkillsSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="skills" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
      <SectionTitle title={c.skills.title} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {c.skills.groups.map((group) => (
          <div key={group.title}>
            <h3
              className="font-display text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--accent-primary)' }}
            >
              {group.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.skills.map((skill) => (
                <span key={skill} className="skill-badge">
                  <SkillBadge skill={skill} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </section>
  )
}
