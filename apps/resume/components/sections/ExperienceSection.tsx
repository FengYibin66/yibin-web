'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, TimelineItem } from '@/components/ui'

export function ExperienceSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="experience" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={c.experience.title} />

        <div className="relative">
          <div
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#00d4ff] to-[#6366f1] opacity-20"
            style={{ transform: 'translateX(-50%)' }}
          />

          {c.experience.items.map((item, i) => (
            <div key={item.id} className="timeline-item">
              <TimelineItem item={item} index={i} learnMoreLabel={c.experience.learnMoreLabel} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
