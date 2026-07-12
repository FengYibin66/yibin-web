'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStableProgress } from '@/hooks/useStableProgress'
import { useScene } from '@/context/SceneContext'
import { hasSeenTutorial, markTutorialSeen, TUTORIAL_OPEN_EVENT } from '@/lib/lab/tutorialStorage'

// Wait for the loader's paper-tear exit (1.8s) to finish before showing
const SHOW_DELAY_MS = 2400

interface ControlRow {
  icon: React.ReactNode
  action: string
  result: string
}

function touchRows(): ControlRow[] {
  return [
    {
      icon: <SwipeVerticalIcon />,
      action: 'Swipe up / down',
      result: 'walk the corridor',
    },
    {
      icon: <SwipeHorizontalIcon />,
      action: 'Swipe left / right',
      result: 'look around',
    },
    {
      icon: <TapIcon />,
      action: 'Tap a door',
      result: 'enter a room',
    },
  ]
}

function mouseRows(): ControlRow[] {
  return [
    {
      icon: <ScrollIcon />,
      action: 'Scroll',
      result: 'walk the corridor',
    },
    {
      icon: <MouseMoveIcon />,
      action: 'Move the mouse',
      result: 'look around',
    },
    {
      icon: <ClickIcon />,
      action: 'Click a door',
      result: 'enter a room',
    },
  ]
}

export function LabTutorial() {
  const { complete } = useStableProgress(600)
  const { isInRoom, isTeleporting } = useScene()
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  // Auto-show once, after the loading tear animation has cleared
  useEffect(() => {
    if (!complete || hasSeenTutorial()) return
    const timer = setTimeout(() => {
      if (!isInRoom && !isTeleporting) setVisible(true)
    }, SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [complete, isInRoom, isTeleporting])

  // "?" button in NavigationUI re-opens it anytime
  useEffect(() => {
    const handleOpen = () => { setLeaving(false); setVisible(true) }
    window.addEventListener(TUTORIAL_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(TUTORIAL_OPEN_EVENT, handleOpen)
  }, [])

  const dismiss = useCallback(() => {
    markTutorialSeen()
    setLeaving(true)
    setTimeout(() => { setVisible(false); setLeaving(false) }, 320)
  }, [])

  // ESC to skip
  useEffect(() => {
    if (!visible) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible, dismiss])

  if (!visible) return null

  const rows = isTouch ? touchRows() : mouseRows()

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-label="How to explore the lab"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(42,31,14,0.35)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.3s ease',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(340px, 92vw)',
          background: '#fdfaf4',
          padding: '26px 26px 22px',
          fontFamily: "'CabinSketch-Bold', serif",
          color: '#2a1f0e',
          transform: leaving ? 'translateY(8px) scale(0.98)' : 'none',
          transition: 'transform 0.3s ease',
          clipPath: `polygon(
            1% 2%, 25% 0%, 50% 1.5%, 75% 0.5%, 99% 2%,
            100% 25%, 98.5% 50%, 100% 75%, 99% 98%,
            75% 100%, 50% 98.5%, 25% 100%, 1% 98%,
            0% 75%, 1.5% 50%, 0% 25%
          )`,
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.25))',
        }}
      >
        <div style={{
          position: 'absolute', inset: '-15%',
          background: "url('/textures/paper-texture.webp') center center / cover",
          zIndex: 0, pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, letterSpacing: '0.06em' }}>
            How to explore
          </h2>
          <p style={{
            margin: '0 0 18px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10.5,
            letterSpacing: '0.15em',
            color: 'rgba(42,31,14,0.5)',
            textTransform: 'uppercase',
          }}>
            {isTouch ? 'Touch controls' : 'Mouse & keyboard'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            {rows.map(row => (
              <div key={row.action} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid rgba(42,31,14,0.25)',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.6)',
                }}>
                  {row.icon}
                </div>
                <div>
                  <div style={{ fontSize: 15, lineHeight: 1.25 }}>{row.action}</div>
                  <div style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    color: 'rgba(42,31,14,0.55)',
                    letterSpacing: '0.04em',
                  }}>
                    {row.result}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button
              onClick={dismiss}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 4px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                letterSpacing: '0.08em',
                color: 'rgba(42,31,14,0.5)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
            <button
              onClick={dismiss}
              autoFocus
              style={{
                background: '#2a1f0e',
                color: '#f5f0e8',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                fontFamily: "'CabinSketch-Bold', serif",
                fontSize: 14,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              Start exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hand-drawn style control icons ───────────────────────────────────────────

const stroke = { fill: 'none', stroke: '#2a1f0e', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function SwipeVerticalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 4v16" />
      <path d="M8.5 7.5L12 4l3.5 3.5" />
      <path d="M8.5 16.5L12 20l-3.5-3.5" />
    </svg>
  )
}

function SwipeHorizontalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 12h16" />
      <path d="M7.5 8.5L4 12l3.5 3.5" />
      <path d="M16.5 8.5L20 12l-3.5 3.5" />
    </svg>
  )
}

function TapIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 11.5V6a2 2 0 0 1 4 0v5" />
      <path d="M13 10.5c0-1 2-1.4 2.6 0l1.6 3.8c.8 1.9-.3 5.2-3.2 5.2h-2.5c-1.3 0-2.4-.6-3-1.7L6.2 14c-.7-1.2.9-2.4 1.9-1.4l.9 1" />
      <path d="M11 2.5c-2 .4-3.4 1.6-4 3" opacity={0.45} />
    </svg>
  )
}

function ScrollIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <rect x="8" y="3" width="8" height="14" rx="4" />
      <path d="M12 6.5v3" />
      <path d="M10 20.5l2 2 2-2" opacity={0.6} />
    </svg>
  )
}

function MouseMoveIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <rect x="8.5" y="6" width="7" height="12" rx="3.5" />
      <path d="M3 12h3" opacity={0.6} />
      <path d="M4.2 10.8L3 12l1.2 1.2" opacity={0.6} />
      <path d="M18 12h3" opacity={0.6} />
      <path d="M19.8 10.8L21 12l-1.2 1.2" opacity={0.6} />
    </svg>
  )
}

function ClickIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 9l10.5 4.2-4.4 1.6-1.9 4.3L9 9z" />
      <path d="M6.5 3.5v2M3.5 6.5h2M4.5 4.5l1.4 1.4" opacity={0.5} />
    </svg>
  )
}
