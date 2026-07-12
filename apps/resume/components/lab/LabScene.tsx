'use client'

import { useRef, useCallback, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
import { InfiniteCorridorManager } from './InfiniteCorridorManager'

// Kick off all texture requests in ONE LoadingManager wave as soon as this
// chunk loads — before components mount and start their suspense waterfalls.
// This is what keeps useProgress from cycling 0→100 multiple times.
if (typeof window !== 'undefined') preloadCorridorTextures()
import { PaperTransition } from './PaperTransition'
import { TeleportRoom } from './TeleportRoom'
import { NavigationUI } from '@/components/ui/NavigationUI'

import { useCorridorCamera } from '@/hooks/useCorridorCamera'
import { preloadCorridorTextures } from '@/lib/lab/texturePreload'
import { PerformanceProvider, usePerformance } from '@/context/PerformanceContext'
import { AudioProvider, useAudio } from '@/context/AudioContext'
import { SceneProvider, useScene } from '@/context/SceneContext'
import { AchievementsProvider, useAchievements } from '@/context/AchievementsContext'
import { WheelRouterProvider } from '@/hooks/useWheelRouter'

// Camera controller lives inside Canvas so it has access to R3F context
function CameraController({
  onSetOverride,
}: {
  onSetOverride: (fn: (active: boolean) => void) => void
}) {
  const { setCameraOverride } = useCorridorCamera({ smoothing: 0.035, scrollSpeed: 0.02 })

  useEffect(() => {
    onSetOverride(setCameraOverride)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function LabCanvas() {
  const { settings } = usePerformance()
  const { playBgm, stopBgm } = useAudio()
  const { isInRoom, markEntered } = useScene()
  const { unlockAchievement } = useAchievements()

  // Mark as entered immediately — /lab route means the user has entered the corridor
  useEffect(() => { markEntered() }, [markEntered])

  // Unlock corridor_explore on first scroll
  const hasScrolledRef = useRef(false)
  useEffect(() => {
    const handleFirstScroll = () => {
      if (hasScrolledRef.current) return
      hasScrolledRef.current = true
      unlockAchievement('corridor_explore')
    }
    window.addEventListener('wheel', handleFirstScroll, { once: true })
    window.addEventListener('touchmove', handleFirstScroll, { once: true })
    return () => {
      window.removeEventListener('wheel', handleFirstScroll)
      window.removeEventListener('touchmove', handleFirstScroll)
    }
  }, [unlockAchievement])

  const setCameraOverrideRef = useRef<(active: boolean) => void>(() => {})

  const handleSetOverride = useCallback((fn: (active: boolean) => void) => {
    setCameraOverrideRef.current = fn
  }, [])

  const setCameraOverride = useCallback((active: boolean) => {
    setCameraOverrideRef.current(active)
  }, [])

  useEffect(() => {
    playBgm('corridor_bg')
    return () => stopBgm()
  }, [playBgm, stopBgm])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0ece4', touchAction: 'none', overscrollBehavior: 'none' }}>
      <Canvas
        camera={{ position: [0, 0.2, 28], fov: 60, near: 0.1, far: 400 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: settings.antialias }}
        dpr={settings.dpr}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#f0ece4', 15, 60]} />
          <CameraController onSetOverride={handleSetOverride} />
          <InfiniteCorridorManager setCameraOverride={setCameraOverride} />

          <TeleportRoom />
        </Suspense>
      </Canvas>

      {!isInRoom && (
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.4em', color: 'rgba(42,31,14,0.4)', margin: 0 }}>
            SCROLL TO EXPLORE
          </p>
        </div>
      )}

      {!isInRoom && (
        <a
          href="/"
          style={{
            position: 'fixed', top: '20px', left: '20px', zIndex: 50,
            fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(200,169,110,0.6)',
            textDecoration: 'none', letterSpacing: '0.1em',
          }}
        >
          ← Exit Lab
        </a>
      )}

      <PaperTransition />
      <NavigationUI />

    </div>
  )
}

export function LabScene() {
  return (
    <PerformanceProvider>
      <AudioProvider>
        <SceneProvider>
          <AchievementsProvider>
            <WheelRouterProvider>
              <LabCanvas />
            </WheelRouterProvider>
          </AchievementsProvider>
        </SceneProvider>
      </AudioProvider>
    </PerformanceProvider>
  )
}
