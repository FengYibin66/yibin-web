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
      // E2E 只能按 testid 定位：Navbar 里也有指向同一 hash 的链接（手机端折叠不可见），
      // 按 href 选会命中它（classicReveal 第一版就是这么在 mobile-safari 上超时的）
      data-testid="classic-back-link"
      className="inline-block mb-8 text-sm no-underline"
      style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
    >
      {label}
    </Link>
  )
}
