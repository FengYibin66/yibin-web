'use client'

import type { ExperienceItem } from '@/lib/content/types'
import { ClassicBackLink } from './ClassicBackLink'

function ImageGrid({
  images,
}: {
  images: { src: string; caption: string; explanation?: string }[]
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map((img) => (
        <figure key={img.src} className="glass-card rounded-xl overflow-hidden">
          <img src={img.src} alt={img.caption} className="w-full h-44 object-cover" loading="lazy" />
          <figcaption className="p-3">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {img.caption}
            </div>
            {img.explanation ? (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {img.explanation}
              </p>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export function ExperienceDetailView({ item }: { item: ExperienceItem }) {
  const detail = item.detail

  if (!detail) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <ClassicBackLink />
        <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {item.role}
        </h1>
        <p className="mt-2" style={{ color: 'var(--accent-primary)' }}>
          {item.company} · {item.period}
        </p>
        <ul className="mt-6 space-y-2">
          {item.bullets.map((b) => (
            <li key={b} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              › {b}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <ClassicBackLink href="/classic/#experience" />

      <header className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {item.role}
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--accent-primary)' }}>
          {item.company} · {item.period}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {item.location}
        </p>
        {detail.intro ? (
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {detail.intro}
          </p>
        ) : null}
        {detail.heroImage ? (
          <img
            src={detail.heroImage}
            alt={item.company}
            className="mt-6 w-full max-h-72 object-cover rounded-xl"
            loading="lazy"
          />
        ) : null}
      </header>

      {detail.video ? (
        <section className="mb-12">
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {detail.video.title}
          </h2>
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10">
            <iframe
              title={detail.video.title}
              src={`https://www.youtube.com/embed/${detail.video.youtubeId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      {detail.sections.map((section) => (
        <section key={section.title} className="mb-10">
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {section.title}
          </h2>
          <ul className="space-y-2">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-primary)' }}>›</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {detail.caseStudy ? (
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {detail.caseStudy.title}
          </h2>
          <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {detail.caseStudy.overview}
          </p>

          <h3 className="font-display font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>
            {detail.caseStudy.challengesTitle}
          </h3>
          <ul className="mb-6 space-y-2">
            {detail.caseStudy.challenges.map((c) => (
              <li key={c} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                › {c}
              </li>
            ))}
          </ul>

          <h3 className="font-display font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>
            {detail.caseStudy.solutionsTitle}
          </h3>
          {detail.caseStudy.solutionsIntro ? (
            <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {detail.caseStudy.solutionsIntro}
            </p>
          ) : null}
          <ul className="mb-6 space-y-2">
            {detail.caseStudy.solutions.map((s) => (
              <li key={s} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                › {s}
              </li>
            ))}
          </ul>

          <h3 className="font-display font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>
            {detail.caseStudy.achievementsTitle}
          </h3>
          <ul className="mb-6 space-y-2">
            {detail.caseStudy.achievements.map((a) => (
              <li key={a} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                › {a}
              </li>
            ))}
          </ul>

          <ImageGrid images={detail.caseStudy.images} />
        </section>
      ) : null}

      {detail.gallery ? (
        <section>
          <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {detail.gallery.title}
          </h2>
          <ImageGrid images={detail.gallery.images} />
        </section>
      ) : null}
    </div>
  )
}
