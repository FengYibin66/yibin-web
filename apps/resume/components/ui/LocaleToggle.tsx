'use client'

import { useLocale } from '../../hooks/useLocale'
import { useLabLabels } from '@/hooks/useLabLabels'

export function LocaleToggle() {
  const { locale, toggle } = useLocale()
  const labels = useLabLabels()

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200
        hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33]"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
      aria-label={labels.panels.toggleLanguage}
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  )
}
