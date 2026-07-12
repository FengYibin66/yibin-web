'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/hooks/useLocale'

export function GalleryDoorSection() {
  const router = useRouter()
  const { locale } = useLocale()
  const doorRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(false)

  const openDoor = () => {
    if (isOpenRef.current) return
    isOpenRef.current = true
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
    right.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
    left.style.transform = 'rotateY(-75deg)'
    right.style.transform = 'rotateY(75deg)'
    setTimeout(() => router.push('/gallery?from=classic'), 700)
  }

  const hoverOpen = () => {
    if (isOpenRef.current) return
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.4s ease'
    right.style.transition = 'transform 0.4s ease'
    left.style.transform = 'rotateY(-20deg)'
    right.style.transform = 'rotateY(20deg)'
  }

  const hoverClose = () => {
    if (isOpenRef.current) return
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.4s ease'
    right.style.transition = 'transform 0.4s ease'
    left.style.transform = 'rotateY(0deg)'
    right.style.transform = 'rotateY(0deg)'
  }

  const label = locale === 'zh' ? '画廊' : 'The Gallery'
  const sublabel = locale === 'zh' ? '摄影 · 2019–2024' : 'Photography · 2019–2024'

  return (
    <section
      id="gallery-door"
      className="relative z-10 w-full"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="py-24 px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Section title */}
        <div className="mb-12 text-center">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {locale === 'zh' ? '探索' : 'Explore'}
          </p>
          <h2
            className="font-display text-3xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </h2>
          <div className="mt-2 h-px w-16 mx-auto bg-gradient-to-r from-[#c8a96e] to-[#8b6914]" />
        </div>

        {/* Door */}
        <div
          ref={doorRef}
          onClick={openDoor}
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
          style={{
            cursor: 'pointer',
            perspective: '1200px',
            width: '280px',
            height: '420px',
            position: 'relative',
            outline: 'none',
          }}
          role="button"
          aria-label={`Enter ${label}`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoor() } }}
        >
          {/* Door frame (pien — threshold piece) */}
          <div style={{
            position: 'absolute',
            inset: '-12px',
            borderRadius: '4px 4px 0 0',
            background: 'linear-gradient(135deg, #3d2b1a 0%, #5a3d25 40%, #2a1a0d 100%)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }} />

          {/* Door container — perspective origin */}
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
            {/* Left panel */}
            <div
              ref={leftPanelRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '100%',
                transformOrigin: 'left center',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/textures/doors/door_left_painted.webp"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                draggable={false}
              />
              {/* Handle */}
              <img
                src="/textures/doors/handle_right_painted.webp"
                alt=""
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '60px',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>

            {/* Right panel */}
            <div
              ref={rightPanelRef}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                transformOrigin: 'right center',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/textures/doors/door_right_painted.webp"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                draggable={false}
              />
              {/* Handle */}
              <img
                src="/textures/doors/handle_left_painted.webp"
                alt=""
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '60px',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>

            {/* Interior glow — visible when door opens */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(245,230,163,0.4) 0%, rgba(200,169,110,0.1) 50%, transparent 70%)',
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Label below door */}
        <div
          className="mt-6 text-center"
          style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}
        >
          <p style={{ fontSize: '15px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            {sublabel}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.1em' }}>
            {locale === 'zh' ? '点击进入' : 'Click to enter'}
          </p>
        </div>
      </div>
    </section>
  )
}
