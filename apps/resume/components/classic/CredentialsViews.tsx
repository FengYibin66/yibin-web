'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle } from '@/components/ui'
import type { CredentialItem } from '@/lib/content/types'

function CredentialCard({ item, onOpen }: { item: CredentialItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card rounded-xl overflow-hidden text-left w-full cursor-pointer"
    >
      {item.image ? (
        <img src={item.image} alt={item.title} className="w-full h-40 object-cover" loading="lazy" />
      ) : null}
      <div className="p-4">
        <h3 className="font-display font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
          {item.title}
        </h3>
        {item.level ? (
          <p className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
            {item.level}
          </p>
        ) : null}
        {item.note ? (
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {item.note}
          </p>
        ) : null}
      </div>
    </button>
  )
}

function Lightbox({ item, onClose }: { item: CredentialItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-w-3xl w-full rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.image ? (
          <img src={item.image} alt={item.title} className="w-full max-h-[70vh] object-contain bg-black" />
        ) : null}
        <div className="p-5">
          <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
            {item.title}
          </h3>
          {item.level ? (
            <p className="text-sm mt-1" style={{ color: 'var(--accent-primary)' }}>
              {item.level}
            </p>
          ) : null}
          {item.note ? (
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {item.note}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-sm underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** Summary strip on Classic scroll page */
export function CredentialsSection() {
  const { locale } = useLocale()
  const c = content[locale].credentials
  const featured = c.awards.slice(0, 3)

  return (
    <section id="credentials" className="relative z-10 w-full" style={{ background: 'var(--bg-base)' }}>
      <div className="py-24 px-6 max-w-6xl mx-auto">
        <SectionTitle title={c.title} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {featured.map((item) => (
            <Link
              key={item.id}
              href="/classic/credentials/"
              className="glass-card rounded-xl overflow-hidden no-underline block"
            >
              {item.image ? (
                <img src={item.image} alt={item.title} className="w-full h-36 object-cover" loading="lazy" />
              ) : null}
              <div className="p-4">
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                {item.level ? (
                  <p className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                    {item.level}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/classic/credentials/"
            className="text-sm no-underline"
            style={{ color: 'var(--accent-primary)' }}
          >
            {c.viewAllLabel} →
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Full credentials page */
export function CredentialsPageView() {
  const { locale } = useLocale()
  const c = content[locale].credentials
  const [active, setActive] = useState<CredentialItem | null>(null)

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <Link
        href="/classic/#credentials"
        className="inline-block mb-8 text-sm no-underline"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← {c.backLabel}
      </Link>

      <h1 className="font-display text-3xl font-bold mb-10" style={{ color: 'var(--text-primary)' }}>
        {c.title}
      </h1>

      <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {c.awardsTitle}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
        {c.awards.map((item) => (
          <CredentialCard key={item.id} item={item} onOpen={() => setActive(item)} />
        ))}
      </div>

      <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {c.certificatesTitle}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {c.certificates.map((item) => (
          <CredentialCard key={item.id} item={item} onOpen={() => setActive(item)} />
        ))}
      </div>

      {active ? <Lightbox item={active} onClose={() => setActive(null)} /> : null}
    </div>
  )
}
