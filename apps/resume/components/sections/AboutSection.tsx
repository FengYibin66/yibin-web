'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, ImagePreview, RichText } from '@/components/ui'

export function AboutSection() {
  const { locale } = useLocale()
  const c = content[locale]

  return (
    <section id="about" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={c.about.title} />

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10 md:gap-14 items-start">
          <div className="mx-auto md:mx-0 w-40 h-40">
            <ImagePreview
              src="/avatar.jpg"
              alt="Yibin Feng"
              className="w-40 h-40 ring-2 ring-[#00d4ff] ring-offset-2 ring-offset-[#070b12]"
              imgClassName="object-cover"
              rounded="rounded-full"
            />
          </div>

          <div className="flex flex-col gap-8 min-w-0">
            <div className="animate-in space-y-4">
              {c.about.bio.map((para, i) => (
                <p key={i} className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <RichText text={para} />
                </p>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {c.about.highlights.map((h) => (
                <div key={h.title} className="glass-card rounded-xl p-5">
                  <div
                    className="font-display font-bold text-base mb-2"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {h.title}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
