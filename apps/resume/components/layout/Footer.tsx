'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'

export function Footer() {
  const { locale } = useLocale()
  const c = content[locale].footer

  return (
    <footer
      className="py-8 text-center border-t"
      style={{ borderColor: 'var(--bg-border)', color: 'var(--text-muted)' }}
    >
      <p className="text-sm">{c.copyright}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {c.builtWith}
      </p>
    </footer>
  )
}
