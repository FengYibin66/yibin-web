'use client'

import { useEffect, useState } from 'react'

import { prefersReducedMotion } from '@/lib/lab/app/motion'
import { TOUR_HINT_MS, hasSeenTourHint, markTourHintSeen, tourHintHeld } from '@/lib/lab/tourHintStorage'

/**
 * 贴着「带我走一遍」按钮的一次性引导（规格 `lab-corridor-story.md` §5.2）。
 *
 * 整块可点——它是 `hint` 层里的交互元素，不是装饰。
 * 不进屏角声明表：那张表管「各占一个角」的挂件，这个必须跟着按钮走
 * （ADR 20260909182319）。调用方要给它一个 `position: relative` 的父元素。
 */
export function TourCoachMark({
  label,
  onStart,
}: {
  label: string
  onStart: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (hasSeenTourHint()) return
    setVisible(true)
    markTourHintSeen()   // 显示过就算看过，不等它淡完

    if (tourHintHeld()) return

    const fade = window.setTimeout(() => setFading(true), TOUR_HINT_MS)
    const gone = window.setTimeout(() => setVisible(false), TOUR_HINT_MS + 400)

    const dismiss = () => { setFading(true); window.setTimeout(() => setVisible(false), 400) }
    const opts = { once: true, passive: true } as const
    window.addEventListener('pointerdown', dismiss, opts)
    window.addEventListener('touchstart', dismiss, opts)
    window.addEventListener('wheel', dismiss, opts)
    // keydown 也要：只听指针会让键盘用户关不掉它
    window.addEventListener('keydown', dismiss, { once: true })

    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(gone)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('touchstart', dismiss)
      window.removeEventListener('wheel', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [])

  if (!visible) return null

  const arrowSize = 12
  const bubbleTop = 'calc(100% + 8px)'

  return (
    <>
    <button
      type="button"
      onClick={() => { setVisible(false); onStart() }}
      data-testid="tour-coach-mark"
      data-fading={fading}
      style={{
        position: 'absolute',
        top: bubbleTop,
        // 右缘与按钮右缘对齐、朝左展开：朝右在 390px 上会冲出视口
        right: 0,
        // 只给 `right` 时收缩宽度按包含块（44px 的按钮包装层）算，气泡会被挤成细长条
        width: 'max-content',
        minHeight: 44,
        maxWidth: 'min(68vw, 260px)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: '#2a1f0e',
        color: '#fffdf7',
        border: 'none',
        borderRadius: 8,
        fontFamily: 'var(--font-sketch-bold)',
        fontSize: 12,
        lineHeight: 1.35,
        letterSpacing: '0.02em',
        textAlign: 'left',
        cursor: 'pointer',
        whiteSpace: 'normal',
        boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
        opacity: fading ? 0 : 1,
        transition: reduced ? 'none' : 'opacity 0.4s ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ flexShrink: 0 }} aria-hidden>
        <ellipse cx="12" cy="15.5" rx="4.4" ry="5.2" />
        <circle cx="6.6" cy="8.6" r="2" /><circle cx="12" cy="6.4" r="2" /><circle cx="17.4" cy="8.6" r="2" />
      </svg>
      {label}
    </button>

    {/*
      三角是**按钮包装层的兄弟**而不是气泡的子元素，`left: 50%` 居中的才是按钮
      ——按钮宽度随视口变（窄屏 44、宽屏带文字 143）。
      放在气泡之后：同层叠上下文里 DOM 靠后的压在上面。
    */}
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: `calc(${bubbleTop} - ${arrowSize / 2}px)`,
        left: '50%',
        width: arrowSize, height: arrowSize,
        background: '#2a1f0e',
        transform: 'translateX(-50%) rotate(45deg)',
        borderRadius: 2,
        opacity: fading ? 0 : 1,
        transition: reduced ? 'none' : 'opacity 0.4s ease',
        pointerEvents: 'none',
      }}
    />
    </>
  )
}
