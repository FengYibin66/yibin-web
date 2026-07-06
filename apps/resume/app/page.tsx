'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { ClassicPanel } from '@/components/entry/ClassicPanel'
import type { EntryPreviewSceneProps } from '@/components/entry/EntryPreviewScene'

const EntryPreviewScene = dynamic<EntryPreviewSceneProps>(
  () => import('@/components/entry/EntryPreviewScene').then(m => ({ default: m.EntryPreviewScene })),
  { ssr: false }
)

export default function EntryPage() {
  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const router   = useRouter()

  useEffect(() => {
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    gsap.fromTo(left,  { xPercent: -100, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })
    gsap.fromTo(right, { xPercent:  100, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })

    // Dispatch resize on every GSAP tick so R3F re-computes the WebGL viewport
    // in sync with the flexBasis CSS animation (ResizeObserver alone is too slow).
    const dispatchResize = () => window.dispatchEvent(new Event('resize'))

    const expandLeft = () => {
      gsap.to(left,  { flexBasis: '72%', duration: 0.6, ease: 'power2.out', onUpdate: dispatchResize })
      gsap.to(right, { flexBasis: '28%', duration: 0.6, ease: 'power2.out' })
    }
    const expandRight = () => {
      gsap.to(right, { flexBasis: '72%', duration: 0.6, ease: 'power2.out' })
      gsap.to(left,  { flexBasis: '28%', duration: 0.6, ease: 'power2.out', onUpdate: dispatchResize })
    }
    const reset = () => {
      gsap.to([left, right], { flexBasis: '50%', duration: 0.5, ease: 'power2.out', onUpdate: dispatchResize })
    }

    left.addEventListener('mouseenter', expandLeft)
    right.addEventListener('mouseenter', expandRight)
    left.addEventListener('mouseleave', reset)
    right.addEventListener('mouseleave', reset)
    return () => {
      left.removeEventListener('mouseenter', expandLeft)
      right.removeEventListener('mouseenter', expandRight)
      left.removeEventListener('mouseleave', reset)
      right.removeEventListener('mouseleave', reset)
    }
  }, [])

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* LEFT — The Lab (hand-drawn corridor preview) */}
      <div
        ref={leftRef}
        style={{
          flexBasis: '50%',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          background: '#f5f0e8',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <EntryPreviewScene onEnter={() => router.push('/lab')} />
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          gap: '8px',
        }}>
          <p style={{
            fontFamily: '"CabinSketch", var(--font-mono, monospace)',
            fontSize: '10px',
            letterSpacing: '0.4em',
            color: 'rgba(42,31,14,0.5)',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Enter
          </p>
          <h1 style={{
            fontFamily: '"CabinSketch", var(--font-display, sans-serif)',
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 700,
            color: '#2a1f0e',
            margin: 0,
            textAlign: 'center',
          }}>
            The Lab
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            color: 'rgba(42,31,14,0.45)',
            letterSpacing: '0.15em',
            textAlign: 'center',
            margin: 0,
          }}>
            Immersive · 3D · Interactive
          </p>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '32px',
          right: '32px',
          fontFamily: 'var(--font-mono)',
          fontSize: '20px',
          color: 'rgba(42,31,14,0.35)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>→</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(42,31,14,0.1)', flexShrink: 0, zIndex: 20 }} />

      {/* RIGHT — Classic (light, elegant) */}
      <div
        ref={rightRef}
        onClick={() => router.push('/classic')}
        style={{
          flexBasis: '50%',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <ClassicPanel />
      </div>

      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px',
        color: 'rgba(42,31,14,0.25)',
        letterSpacing: '0.2em',
        fontFamily: 'var(--font-mono, monospace)',
        zIndex: 30,
        pointerEvents: 'none',
      }}>
        resume.yibinfeng.com
      </div>
    </div>
  )
}
