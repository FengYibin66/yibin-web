'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

export default function EntryPage() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    // Entry animation — panels slide in from edges
    gsap.fromTo(left,
      { xPercent: -100, opacity: 0 },
      { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
    )
    gsap.fromTo(right,
      { xPercent: 100, opacity: 0 },
      { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
    )

    // Hover expand handlers
    const expandLeft = () => {
      gsap.to(left,  { flexBasis: '68%', duration: 0.5, ease: 'power2.out' })
      gsap.to(right, { flexBasis: '32%', duration: 0.5, ease: 'power2.out' })
      gsap.to(left.querySelector('.panel-bg'),  { scale: 1.05, duration: 0.5, ease: 'power2.out' })
      gsap.to(right.querySelector('.panel-bg'), { scale: 1.0,  duration: 0.5, ease: 'power2.out' })
    }
    const expandRight = () => {
      gsap.to(right, { flexBasis: '68%', duration: 0.5, ease: 'power2.out' })
      gsap.to(left,  { flexBasis: '32%', duration: 0.5, ease: 'power2.out' })
      gsap.to(right.querySelector('.panel-bg'), { scale: 1.05, duration: 0.5, ease: 'power2.out' })
      gsap.to(left.querySelector('.panel-bg'),  { scale: 1.0,  duration: 0.5, ease: 'power2.out' })
    }
    const resetPanels = () => {
      gsap.to([left, right], { flexBasis: '50%', duration: 0.5, ease: 'power2.out' })
      gsap.to([left.querySelector('.panel-bg'), right.querySelector('.panel-bg')], { scale: 1.0, duration: 0.5, ease: 'power2.out' })
    }

    left.addEventListener('mouseenter', expandLeft)
    right.addEventListener('mouseenter', expandRight)
    left.addEventListener('mouseleave', resetPanels)
    right.addEventListener('mouseleave', resetPanels)

    return () => {
      left.removeEventListener('mouseenter', expandLeft)
      right.removeEventListener('mouseenter', expandRight)
      left.removeEventListener('mouseleave', resetPanels)
      right.removeEventListener('mouseleave', resetPanels)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#070b12',
        cursor: 'pointer',
      }}
    >
      {/* Left — The Lab */}
      <div
        ref={leftRef}
        onClick={() => router.push('/lab')}
        style={{ flexBasis: '50%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="panel-bg"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #0d1220 0%, #141926 40%, #0a0f1a 100%)',
            willChange: 'transform',
          }}
        />
        {/* Corridor depth lines — decorative */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
          {[0.2, 0.35, 0.5, 0.65, 0.8].map((x) => (
            <div key={x} style={{ position: 'absolute', left: `${x * 100}%`, top: 0, bottom: 0, width: '1px', background: 'linear-gradient(to bottom, transparent, #00d4ff, transparent)' }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px' }}>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase' }}>
            Enter
          </p>
          <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: '#f0f4ff', margin: 0, textAlign: 'center' }}>
            The Lab
          </h1>
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '13px', color: 'rgba(139,155,188,0.8)', letterSpacing: '0.15em', textAlign: 'center' }}>
            Immersive · 3D · Interactive
          </p>
          <div style={{ marginTop: '24px', width: '32px', height: '1px', background: 'linear-gradient(to right, #00d4ff, #6366f1)' }} />
        </div>
        {/* Arrow */}
        <div style={{ position: 'absolute', bottom: '40px', right: '40px', color: 'rgba(0,212,255,0.5)', fontSize: '24px' }}>→</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', flexShrink: 0, zIndex: 20 }} />

      {/* Right — Classic */}
      <div
        ref={rightRef}
        onClick={() => router.push('/classic')}
        style={{ flexBasis: '50%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="panel-bg"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(225deg, #0d1220 0%, #0f1628 40%, #070b12 100%)',
            willChange: 'transform',
          }}
        />
        {/* Grid lines — decorative */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ position: 'absolute', left: `${(i / 7) * 100}%`, top: 0, bottom: 0, width: '1px', background: '#6366f1' }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px' }}>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(99,102,241,0.6)', textTransform: 'uppercase' }}>
            View
          </p>
          <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: '#f0f4ff', margin: 0, textAlign: 'center' }}>
            Classic
          </h1>
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '13px', color: 'rgba(139,155,188,0.8)', letterSpacing: '0.15em', textAlign: 'center' }}>
            Clean · Fast · Standard
          </p>
          <div style={{ marginTop: '24px', width: '32px', height: '1px', background: 'linear-gradient(to right, #6366f1, #8b5cf6)' }} />
        </div>
        {/* Arrow */}
        <div style={{ position: 'absolute', bottom: '40px', right: '40px', color: 'rgba(99,102,241,0.5)', fontSize: '24px' }}>→</div>
      </div>

      {/* Bottom credit */}
      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'rgba(139,155,188,0.4)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono, monospace)', zIndex: 30, pointerEvents: 'none' }}>
        resume.yibinfeng.com
      </div>
    </div>
  )
}
