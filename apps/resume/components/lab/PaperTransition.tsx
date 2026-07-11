'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useScene } from '@/context/SceneContext'
import { useAudio } from '@/context/AudioContext'
import gsap from 'gsap'

// Reusable SVG tear line drawn on top of each half
function TearLineSVG({ svgPathData }: { svgPathData: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <path
        d={svgPathData}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PaperTransition() {
  const { teleportPhase, startTeleportTransition, finishPaperOpen } = useScene()
  const { play } = useAudio()

  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  // Generate stable tear points — computed once at mount, never changes on re-render
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

  // SVG path string for the visible tear line
  const svgPathData = useMemo(() => {
    return tearPoints
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ')
  }, [tearPoints])

  // CSS clip-path polygon — left half keeps the tear edge and extends left
  const leftClip = useMemo(() => {
    const edge = tearPoints.map(([x, y]) => `${x}% ${y}%`).join(', ')
    return `polygon(0% 0%, ${edge}, 0% 100%)`
  }, [tearPoints])

  // Right half: reversed tear edge, extends right
  const rightClip = useMemo(() => {
    const edge = [...tearPoints]
      .reverse()
      .map(([x, y]) => `${x}% ${y}%`)
      .join(', ')
    return `polygon(100% 0%, 100% 100%, ${edge})`
  }, [tearPoints])

  useEffect(() => {
    const container = containerRef.current
    const left = leftRef.current
    const right = rightRef.current
    if (!container || !left || !right) return

    // Kill any in-progress timeline before starting a new phase
    if (timelineRef.current) {
      timelineRef.current.kill()
      timelineRef.current = null
    }

    if (teleportPhase === 'closing') {
      // Make visible, reset opacity, position halves off-screen
      gsap.set(container, { display: 'block', opacity: 1 })
      gsap.set(left, { xPercent: -100, rotation: -2 })
      gsap.set(right, { xPercent: 100, rotation: 2 })

      // Play sound (paper closing)
      play('paper_tear', { volume: 0.6 })

      // Fly halves together; call startTeleportTransition when done
      const tl = gsap.timeline({
        onComplete: () => startTeleportTransition(),
      })
      tl.to(left, { xPercent: 0, rotation: 0, duration: 0.8, ease: 'power2.inOut' }, 0)
      tl.to(right, { xPercent: 0, rotation: 0, duration: 0.8, ease: 'power2.inOut' }, 0)
      timelineRef.current = tl
    } else if (teleportPhase === 'teleporting') {
      // Paper is closed; waiting for scene/camera to finish — no animation needed
    } else if (teleportPhase === 'opening') {
      // Play sound (paper tearing open)
      play('paper_tear', { volume: 0.8 })

      // Fly halves apart, fade container near the end
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(container, { display: 'none', opacity: 1 })
          finishPaperOpen()
        },
      })
      tl.to(left, { xPercent: -100, rotation: -2, duration: 1.2, ease: 'power3.inOut' }, 0)
      tl.to(right, { xPercent: 100, rotation: 2, duration: 1.2, ease: 'power3.inOut' }, 0)
      tl.to(container, { opacity: 0, duration: 0.3 }, 0.9)
      timelineRef.current = tl
    } else if (teleportPhase === null) {
      // Reset to hidden when no transition is active
      gsap.set(container, { display: 'none' })
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill()
        timelineRef.current = null
      }
    }
  }, [teleportPhase, startTeleportTransition, finishPaperOpen, play])

  const paperStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: '#f5f0e8',
    backgroundImage: 'url(/textures/paper-texture.webp)',
    backgroundSize: '400px auto',
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Left half */}
      <div
        ref={leftRef}
        style={{
          ...paperStyle,
          width: '55%',  // Slightly wider than 50% to guarantee no gap at seam
          clipPath: leftClip,
        }}
      >
        <TearLineSVG svgPathData={svgPathData} />
      </div>

      {/* Right half */}
      <div
        ref={rightRef}
        style={{
          ...paperStyle,
          left: '45%',   // Overlaps left half by 10% — eliminates any visible gap
          width: '55%',
          clipPath: rightClip,
        }}
      >
        <TearLineSVG svgPathData={svgPathData} />
      </div>
    </div>
  )
}
