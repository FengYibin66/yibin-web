'use client'
import { useEffect, useRef, useMemo, useState } from 'react'
import gsap from 'gsap'
import { useStableProgress } from '@/hooks/useStableProgress'

const SLOW_LOAD_HINT_MS = 8000

export function LabLoader() {
  // Monotonic progress (never jumps back to 0 between load waves);
  // `complete` only fires after loading has been quiet for a while.
  const { progress, complete } = useStableProgress(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const exitedRef = useRef(false)

  // Escape hatch — on slow connections (mobile), offer the classic view
  // instead of leaving the user staring at a progress ring.
  const [showSlowHint, setShowSlowHint] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!exitedRef.current) setShowSlowHint(true)
    }, SLOW_LOAD_HINT_MS)
    return () => clearTimeout(timer)
  }, [])

  // Generate stable tear points — same algorithm as PaperTransition
  const tearPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [[50, 0]]
    for (let i = 1; i <= 11; i++) {
      const y = (i / 12) * 100
      // Layered sin waves to mimic hand-torn paper
      const x = 50 + Math.sin(i * 2.3 + 1.1) * 3.2 + Math.sin(i * 5.7 + 0.7) * 1.5
      pts.push([x, y])
    }
    pts.push([50, 100])
    return pts
  }, [])

  const leftClip = `polygon(0% 0%, ${tearPoints.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 0% 100%)`
  const rightClip = `polygon(100% 0%, ${tearPoints.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 100% 100%)`

  // Direct DOM update for progress text — bypass React re-renders
  useEffect(() => {
    if (textRef.current) {
      textRef.current.textContent = `${progress}%`
    }
  }, [progress])

  // Trigger exit animation only on STABLE completion (all waves done + quiet)
  useEffect(() => {
    if (complete && !exitedRef.current) {
      exitedRef.current = true
      const container = containerRef.current
      const left = leftRef.current
      const right = rightRef.current
      if (!container || !left || !right) return

      console.info('[LabLoader] all textures loaded — playing tear exit')
      setShowSlowHint(false)
      const tl = gsap.timeline({
        onComplete: () => gsap.set(container, { display: 'none' }),
      })
      tl.to(left,      { xPercent: -100, rotation: -2, duration: 1.8, ease: 'power3.inOut' }, 0)
      tl.to(right,     { xPercent: 100,  rotation: 2,  duration: 1.8, ease: 'power3.inOut' }, 0)
      tl.to(container, { opacity: 0, duration: 0.4 }, 1.4)
    }
  }, [complete])

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Left half */}
      <div
        ref={leftRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '55%',
          background: '#f5f0e8',
          backgroundImage: 'url(/textures/paper-texture.webp)',
          backgroundSize: '400px auto',
          clipPath: leftClip,
        }}
      />

      {/* Right half */}
      <div
        ref={rightRef}
        style={{
          position: 'absolute',
          inset: 0,
          left: '45%',
          width: '55%',
          background: '#f5f0e8',
          backgroundImage: 'url(/textures/paper-texture.webp)',
          backgroundSize: '400px auto',
          clipPath: rightClip,
        }}
      />

      {/* Centre progress indicator */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          {/* Slow-connection escape hatch */}
          {showSlowHint && (
            <a
              href="/classic"
              style={{
                position: 'absolute',
                top: 'calc(100% + 28px)',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                letterSpacing: '0.08em',
                color: 'rgba(42,31,14,0.65)',
                textDecoration: 'underline',
                textUnderlineOffset: 4,
                pointerEvents: 'auto',
              }}
            >
              Slow connection? Open Classic View →
            </a>
          )}
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            style={{ overflow: 'visible' }}
          >
            {/* Outer dashed ring — clockwise spin */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="#2a1f0e"
              strokeWidth="1.5"
              strokeDasharray="10 15"
              style={{
                animation: 'llSpin 10s linear infinite',
                transformOrigin: '50px 50px',
              }}
            />
            {/* Inner dashed ring — counter-clockwise spin */}
            <circle
              cx="50" cy="50" r={28}
              fill="none"
              stroke="#2a1f0e"
              strokeWidth="1"
              strokeDasharray="5 10"
              style={{
                animation: 'llSpinRev 4s linear infinite',
                transformOrigin: '50px 50px',
              }}
            />
            {/* Progress arc */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="rgba(42,31,14,0.3)"
              strokeWidth="1.5"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>

          {/* Percentage text */}
          <span
            ref={textRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: "'CabinSketch-Bold', serif",
              fontSize: 18,
              fontWeight: 'bold',
              color: '#2a1f0e',
              mixBlendMode: 'multiply',
              userSelect: 'none',
            }}
          >
            0%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes llSpin    { to { transform: rotate(360deg)  } }
        @keyframes llSpinRev { to { transform: rotate(-360deg) } }
      `}</style>
    </div>
  )
}
