'use client'

import { useLocale } from '../../hooks/useLocale'
import { useLabLabels } from '@/hooks/useLabLabels'
import { nextLocaleLabel } from '@/lib/content/localeToggle'

export function LocaleToggle() {
  const { locale, toggle } = useLocale()
  const labels = useLabLabels()

  return (
    <button
      type="button"
      onClick={toggle}
      /* min-h/w-11 = 44px 触摸目标 */
      className="inline-flex items-center justify-center px-3 min-h-11 min-w-11 rounded-full text-sm font-medium border transition-all duration-200
        hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33]"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
      aria-label={labels.panels.toggleLanguage}
      /* 稳定把手：可见文字与 aria-label 都随语言变，E2E 只能按它定位 */
      data-testid="locale-toggle"
    >
      {nextLocaleLabel(locale)}
    </button>
  )
}
