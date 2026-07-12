'use client'

import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'

export function ClassicPanel() {
  const { locale } = useLocale()
  const hero = content[locale].hero

  const tags =
    locale === 'zh'
      ? [
          { icon: '◈', label: 'AI 研究' },
          { icon: '◉', label: '前端工程' },
          { icon: '◎', label: '结构工程' },
        ]
      : [
          { icon: '◈', label: 'AI Research' },
          { icon: '◉', label: 'Frontend' },
          { icon: '◎', label: 'Structural' },
        ]

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
        color: 'rgba(200,169,110,0.7)',
        textTransform: 'uppercase',
        marginBottom: '20px',
        margin: '0 0 20px',
      }}>
        Classic View
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
            <div style={{ fontSize: '18px', color: '#c8a96e', marginBottom: '4px' }}>{icon}</div>
            <div style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: '#9c8570',
            }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        letterSpacing: '0.2em',
        color: '#c8a96e',
      }}>
        ENTER →
      </div>
    </div>
  )
}
