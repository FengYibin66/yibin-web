'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, ProjectCard } from '@/components/ui'

export function ProjectsSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="projects" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
      <SectionTitle title={c.projects.title} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {c.projects.items.map((item) => (
          <div key={item.name} className="project-card" data-skew="">
            <ProjectCard item={item} />
          </div>
        ))}
      </div>
    </div>
    </section>
  )
}
