'use client'
import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useMemo } from 'react'
import gsap from 'gsap'

export function LabLoader() {
  const { progress, active } = useProgress()
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const exitedRef = useRef(false)

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
      const display = active ? Math.min(Math.round(progress), 85) : Math.round(progress)
      textRef.current.textContent = `${display}%`
    }
  }, [progress, active])

  // Trigger exit animation when loading completes
  useEffect(() => {
    if (!active && progress >= 100 && !exitedRef.current) {
      exitedRef.current = true
      const container = containerRef.current
      const left = leftRef.current
      const right = rightRef.current
      if (!container || !left || !right) return

      const tl = gsap.timeline({
        onComplete: () => gsap.set(container, { display: 'none' }),
      })
      tl.to(left,      { xPercent: -100, rotation: -2, duration: 1.8, ease: 'power3.inOut' }, 0)
      tl.to(right,     { xPercent: 100,  rotation: 2,  duration: 1.8, ease: 'power3.inOut' }, 0)
      tl.to(container, { opacity: 0, duration: 0.4 }, 1.4)
    }
  }, [active, progress])

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const displayProgress = active ? Math.min(progress, 85) : progress
  const offset = circumference - (displayProgress / 100) * circumference

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
