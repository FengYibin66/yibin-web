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
      className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200
        hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33]"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
      aria-label={labels.panels.toggleLanguage}
      /*
        测试用的稳定把手。

        不能让 E2E 按 `aria-label` 或可见文字定位这个按钮：两者都随语言变
        （标签刻意用**目标语言**写，见 `labUi.panels.toggleLanguage` 的注释），
        于是"切过去再切回来"的用例第二次点击必然失配。而 `getByRole(name)`
        匹配的是**可访问名**（= aria-label），不是可见文字，所以退回按
        '中文' 定位同样不成立。既然两个自然把手都随语言变，就给一个不变的。
      */
      data-testid="locale-toggle"
    >
      {nextLocaleLabel(locale)}
    </button>
  )
}
