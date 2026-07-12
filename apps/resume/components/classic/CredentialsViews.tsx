'use client'

import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { SectionTitle, ImagePreview } from '@/components/ui'
import type { CredentialItem } from '@/lib/content/types'

function CredentialCard({ item }: { item: CredentialItem }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden text-left w-full">
      {item.image ? (
        <ImagePreview
          src={item.image}
          alt={item.title}
          caption={item.title}
          className="aspect-[4/3] w-full"
          imgClassName="object-cover"
          rounded="rounded-none"
        />
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
            <div key={item.id} className="glass-card rounded-xl overflow-hidden">
              {item.image ? (
                <ImagePreview
                  src={item.image}
                  alt={item.title}
                  caption={item.title}
                  className="aspect-[4/3] w-full"
                  imgClassName="object-cover"
                  rounded="rounded-none"
                />
              ) : null}
              <Link href="/classic/credentials/" className="block p-4 no-underline">
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                {item.level ? (
                  <p className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                    {item.level}
                  </p>
                ) : null}
              </Link>
            </div>
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
          <CredentialCard key={item.id} item={item} />
        ))}
      </div>

      <h2 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {c.certificatesTitle}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {c.certificates.map((item) => (
          <CredentialCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
