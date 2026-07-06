import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { useProjects } from '@/lib/api'
import { useLocaleStore } from '@/store/locale'
import { translations } from '@/lib/i18n'

export default function Projects() {
  const { data: projects = [] } = useProjects()
  const { locale } = useLocaleStore()
  const t = translations[locale]

  return (
    <section id="projects" className="py-24 px-6 max-w-5xl mx-auto w-full">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold text-center mb-14"
        style={{ fontFamily: 'Space Grotesk, system-ui', color: 'var(--text-primary)' }}
      >
        {t.projects.title}
      </motion.h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {projects.map((project, i) => {
          const name = locale === 'zh' ? project.nameZh : project.nameEn
          const desc = locale === 'zh' ? project.descZh : project.descEn
          const tags: string[] = JSON.parse(project.techTags ?? '[]')

          return (
            <motion.a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-xl border p-6 flex flex-col gap-4 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bg-border)')}
            >
              {project.screenshotPath && (
                <img
                  src={project.screenshotPath}
                  alt={name}
                  className="w-full h-40 object-cover rounded-lg"
                />
              )}

              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, system-ui', color: 'var(--text-primary)' }}>
                  {name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  project.status === 'live'
                    ? 'bg-[#00d4ff22] text-[#00d4ff]'
                    : 'bg-[#6366f122] text-[#6366f1]'
                }`}>
                  {project.status === 'live' ? t.projects.live : t.projects.dev}
                </span>
              </div>

              <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{desc}</p>

              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="inline-flex items-center gap-1.5 text-sm font-medium mt-auto" style={{ color: 'var(--accent-primary)' }}>
                {t.projects.visit} <ExternalLink size={14} />
              </div>
            </motion.a>
          )
        })}
      </div>
    </section>
  )
}
