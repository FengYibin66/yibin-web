'use client'

import { useRef, useCallback, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CorridorGeometry, CorridorAlcoves } from './CorridorGeometry'
import { DoorSection } from './DoorSection'
import { PaperTransition } from './PaperTransition'
import { TeleportRoom } from './TeleportRoom'
import { NavigationUI } from '@/components/ui/NavigationUI'
import { Avatar } from './Avatar'
import { Doodles } from './Doodles'
import { Cat } from './Cat'
import { CorridorWindow } from './CorridorWindow'
import { BugEaster } from './BugEaster'
import { useCorridorCamera } from '@/hooks/useCorridorCamera'
import { HeroText } from './HeroText'
import { CorridorDecorations } from './CorridorDecorations'
import { SegmentDoor } from './SegmentDoor'
import { PerformanceProvider, usePerformance } from '@/context/PerformanceContext'
import { AudioProvider, useAudio } from '@/context/AudioContext'
import { SceneProvider, useScene } from '@/context/SceneContext'
import { AchievementsProvider } from '@/context/AchievementsContext'
import type { RoomId } from '@/context/SceneContext'

const DOORS_LOOP1 = [
  { z:  -8,  side: 'left'  as const, type: 'about',    label: 'About',        room: 'about'        as RoomId, seg: 0 },
  { z: -20,  side: 'right' as const, type: 'projekty', label: 'Projects',     room: 'projects'     as RoomId, seg: 0 },
  { z: -32,  side: 'left'  as const, type: 'kontakt',  label: 'Publications', room: 'publications' as RoomId, seg: 0 },
  { z: -44,  side: 'right' as const, type: 'social',   label: 'Gallery',      room: 'gallery'      as RoomId, seg: 0 },
  { z: -56,  side: 'left'  as const, type: 'kontakt',  label: 'Contact',      room: 'contact'      as RoomId, seg: 0 },
]

// Second loop 100 units further — produces the "infinite corridor" feeling
const DOORS_LOOP2 = DOORS_LOOP1.map(d => ({ ...d, z: d.z - 100, seg: 1 }))

const ALL_DOORS = [...DOORS_LOOP1, ...DOORS_LOOP2]

// Camera controller inside Canvas context — exposes setCameraOverride via ref callback
function CameraController({
  onSetOverride,
}: {
  onSetOverride: (fn: (active: boolean) => void) => void
}) {
  const { setCameraOverride } = useCorridorCamera({ smoothing: 0.035, scrollSpeed: 0.02 })

  // Expose the function to parent once on mount
  useEffect(() => {
    onSetOverride(setCameraOverride)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// Inner component — can access all Contexts (AudioProvider, SceneProvider, etc.)
function LabCanvas() {
  const { settings } = usePerformance()
  const { playBgm, stopBgm } = useAudio()
  const { isInRoom } = useScene()

  // setCameraOverride is set by CameraController after mount
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
    <div style={{ width: '100vw', height: '100vh', background: '#f0ece4' }}>
      {/* 3D Corridor Canvas */}
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: settings.antialias }}
        dpr={settings.dpr}
      >
        <Suspense fallback={null}>
          <CameraController onSetOverride={handleSetOverride} />
          <CorridorGeometry />
          {ALL_DOORS.map((door) => (
            <DoorSection
              key={`${door.room}-${door.z}`}
              position={[door.side === 'left' ? -3.5 : 3.5, 0, door.z]}
              side={door.side}
              type={door.type}
              label={door.label}
              roomId={door.room}
              segmentIndex={door.seg}
              setCameraOverride={setCameraOverride}
            />
          ))}
          <HeroText visible={!isInRoom} position={[0, 0.3, -4]} />
          <Avatar />
          <Doodles offsetZ={0} />
          <Cat position={[-2, -1.75 + 0.6, 2]} />
          <CorridorWindow />
          <BugEaster />
          <CorridorDecorations />
          {/* Alcove return walls at each door — breaks up flat side walls, adds depth */}
          <CorridorAlcoves doorPositions={ALL_DOORS.map(d => ({ z: d.z, side: d.side }))} />
          {/* Segment transition doors — auto-open on approach, mark loop boundaries */}
          <SegmentDoor position={[0, 0, -65]} />
          <SegmentDoor position={[0, 0, -165]} />
          <TeleportRoom />
        </Suspense>
      </Canvas>

      {/* Scroll hint */}
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

      {/* Back to entry link */}
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

      {/* Paper transition — reads SceneContext.teleportPhase directly, no props */}
      <PaperTransition />

      {/* Navigation UI — map, back button, audio toggle */}
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
            <LabCanvas />
          </AchievementsProvider>
        </SceneProvider>
      </AudioProvider>
    </PerformanceProvider>
  )
}
