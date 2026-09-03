'use client'

import { useLabLabels } from '@/hooks/useLabLabels'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { ENTRY_COLORS } from '@/lib/lab/domain/overlayColors'

export function ClassicPanel() {
  const { locale } = useLocale()
  const hero = content[locale].hero
  const labels = useLabLabels()

  /*
    标签文案本来就是中英分支，只是**硬编码在组件里**而不是 content 里。搬进
    `labUi.entry.classicTags` 之后：改文案不用碰组件，漏译门禁也能看见它
    （它扫的是 content 与组件里的字面量，组件内联的条件分支两边都算硬编码）。
    图标留在这里——那是排版而不是文案。
  */
  const ICONS = ['◈', '◉', '◎']
  const tags = labels.entry.classicTags.map((label, i) => ({
    icon: ICONS[i] ?? '◈',
    label,
  }))

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#f5f2ed',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 40px',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '10px',
        letterSpacing: '0.35em',
        color: ENTRY_COLORS.gold,
        textTransform: 'uppercase',
        marginBottom: '20px',
        margin: '0 0 20px',
      }}>
        {labels.entry.classicTitle}
      </p>

      <h1 style={{
        fontFamily: 'var(--font-gallery, "Cormorant Garamond", serif)',
        fontSize: 'clamp(2.4rem, 4vw, 4rem)',
        fontWeight: 500,
        color: '#2a1f0e',
        margin: 0,
        letterSpacing: '0.02em',
        lineHeight: 1.1,
        textAlign: 'center',
      }}>
        {hero.name}
      </h1>

      <div style={{
        width: '48px',
        height: '1px',
        background: '#c8a96e',
        margin: '20px auto',
      }} />

      <p style={{
        fontFamily: 'var(--font-gallery, "Cormorant Garamond", serif)',
        fontSize: 'clamp(0.75rem, 1.2vw, 1rem)',
        color: '#6b5744',
        letterSpacing: '0.08em',
        textAlign: 'center',
        margin: '0 0 32px',
        fontStyle: 'italic',
        maxWidth: '420px',
        lineHeight: 1.6,
      }}>
        {hero.roles.join(' · ')}
      </p>

      <div style={{ display: 'flex', gap: '28px', marginBottom: '40px' }}>
        {tags.map(({ icon, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', color: ENTRY_COLORS.gold, marginBottom: '4px' }}>{icon}</div>
            <div style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: ENTRY_COLORS.tag,
            }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        letterSpacing: '0.2em',
        color: ENTRY_COLORS.gold,
      }}>
        {labels.entry.classicCta}
      </div>
    </div>
  )
}
