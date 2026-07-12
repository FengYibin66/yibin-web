'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, ProjectCard } from '@/components/ui'
import type { ProjectCategory } from '@/lib/content/types'

function CategoryBlock({ category }: { category: ProjectCategory }) {
  return (
    <div className="mb-14 last:mb-0">
      <div className="mb-6">
        <h3
          className="font-display font-bold text-xl md:text-2xl"
          style={{ color: 'var(--text-primary)' }}
        >
          {category.title}
        </h3>
        {category.summary ? (
          <p className="mt-2 text-sm md:text-base max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
            {category.summary}
          </p>
        ) : null}
      </div>

      {category.groups?.map((group) => (
        <div key={group.title} className="mb-8 last:mb-0">
          <h4
            className="font-display font-semibold text-base mb-1"
            style={{ color: 'var(--accent-primary)' }}
          >
            {group.title}
          </h4>
          {group.summary ? (
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {group.summary}
            </p>
          ) : (
            <div className="mb-4" />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {group.items.map((item) => (
              <div key={item.name} className="project-card" data-skew="">
                <ProjectCard item={item} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {category.items && category.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {category.items.map((item) => (
            <div key={item.name} className="project-card" data-skew="">
              <ProjectCard item={item} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ProjectsSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="projects" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={c.projects.title} />

        {c.projects.categories.map((category) => (
          <CategoryBlock key={category.id} category={category} />
        ))}
      </div>
    </section>
  )
}
