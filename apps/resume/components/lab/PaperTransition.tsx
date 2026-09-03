'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useScene } from '@/context/SceneContext'
import { useAudio } from '@/context/AudioContext'
import { buildTearPoints, tearEdgeCoords, tearSvgPath } from '@/lib/lab/tearEdge'
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

  // 与 LabLoader 共用同一条撕痕（lib/lab/tearEdge）：loader 退场与传送合纸是
  // 同一张纸的视觉延续，两处各算一份的话改了参数就会露馅。
  const tearPoints = useMemo(() => buildTearPoints(), [])

  const svgPathData = useMemo(() => tearSvgPath(tearPoints), [tearPoints])

  const leftClip = useMemo(
    () => `polygon(0% 0%, ${tearEdgeCoords(tearPoints)}, 0% 100%)`,
    [tearPoints],
  )

  // 右半：撕痕反向，向右延伸
  const rightClip = useMemo(
    () => `polygon(100% 0%, 100% 100%, ${tearEdgeCoords([...tearPoints].reverse())})`,
    [tearPoints],
  )

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
