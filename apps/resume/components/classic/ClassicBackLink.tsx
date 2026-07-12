'use client'

import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'

export function ClassicBackLink({ href = '/classic/' }: { href?: string }) {
  const { locale } = useLocale()
  const label = content[locale].classicUi.backToClassic

  return (
    <Link
      href={href}
      className="inline-block mb-8 text-sm no-underline"
      style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
    >
      {label}
    </Link>
  )
}
