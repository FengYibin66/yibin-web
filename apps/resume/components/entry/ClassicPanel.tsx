'use client'

import { useLabLabels } from '@/hooks/useLabLabels'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { heroNames } from '@/lib/content/heroName'
import { ENTRY_COLORS } from '@/lib/lab/domain/overlayColors'

export function ClassicPanel() {
  const { locale } = useLocale()
  const hero = content[locale].hero
  const labels = useLabLabels()
  // 名字按语言分主次（zh 主中文）：规则在 heroName.ts，与 Classic 首屏共用
  const names = heroNames(hero, locale)

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
        {names.primary}
      </h1>
      <p
        data-testid="classic-panel-secondary-name"
        style={{
          fontFamily: 'var(--font-gallery, "Cormorant Garamond", serif)',
          fontSize: 'clamp(0.85rem, 1.3vw, 1.1rem)',
          // 与头衔行同色：#8a7560 在 #f5f2ed 上只有 3.86，对比度门禁要 4.5
          color: '#6b5744',
          letterSpacing: '0.12em',
          margin: '10px 0 0',
          textAlign: 'center',
        }}
      >
        {names.secondary}
      </p>

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

      {/*
        字号 9px → 11px（2026-09-09）。

        9px 大写 + `.2em` 字距在 390×844 / DPR 3 上，笔画宽度不足一个稳定物理像素，
        抗锯齿后是灰糊；而字距放大会进一步把字母拆散、降低字形辨识。11px 是
        Apple HIG 最小正文（11pt）与 Material `labelSmall`（11sp）的共同下限。

        抬字号必须同时改三处，否则 320px 上会溢出：
          gap 28 → 16        三个标签变宽约 24%，原间距吃不下
          flexWrap: 'wrap'   放不下就换行，而不是把容器推宽
          justifyContent     换行后仍然居中，不然第二行会贴左
        字距 .2em → .12em 抵消一部分增宽，同时 11px 下 .12em 的可读性优于 .2em。
      */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '40px',
      }}>
        {tags.map(({ icon, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', color: ENTRY_COLORS.gold, marginBottom: '4px' }}>{icon}</div>
            <div style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.12em',
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
