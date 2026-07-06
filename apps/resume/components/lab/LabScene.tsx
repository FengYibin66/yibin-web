'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CorridorGeometry, CorridorAlcoves } from './CorridorGeometry'
import { CorridorDoor } from './CorridorDoor'
import { RoomOverlay } from './RoomOverlay'
import { PaperTransition } from './PaperTransition'
import { AudioToggle } from './AudioToggle'
import { Avatar } from './Avatar'
import { Doodles } from './Doodles'
import { Cat } from './Cat'
import { CorridorWindow } from './CorridorWindow'
import { BugEaster } from './BugEaster'
import { useCorridorCamera } from '@/hooks/useCorridorCamera'
import { audioManager } from '@/lib/audio/audioManager'
import { HeroText } from './HeroText'
import { CorridorDecorations } from './CorridorDecorations'
import { SegmentDoor } from './SegmentDoor'

type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact' | null

// Camera controller inside Canvas context
function CameraController({ scrollEnabled }: { scrollEnabled: boolean }) {
  useCorridorCamera({ smoothing: 0.035, scrollSpeed: 0.02, scrollEnabled })
  return null
}

const DOORS_LOOP1 = [
  { z:  -8,  side: 'left'  as const, type: 'about',    label: 'About',        room: 'about'        as const },
  { z: -20,  side: 'right' as const, type: 'projekty', label: 'Projects',     room: 'projects'     as const },
  { z: -32,  side: 'left'  as const, type: 'kontakt',  label: 'Publications', room: 'publications' as const },
  { z: -44,  side: 'right' as const, type: 'social',   label: 'Gallery',      room: 'gallery'      as const },
  { z: -56,  side: 'left'  as const, type: 'kontakt',  label: 'Contact',      room: 'contact'      as const },
]

// Second loop 100 units further — produces the "infinite corridor" feeling
const DOORS_LOOP2 = DOORS_LOOP1.map(d => ({ ...d, z: d.z - 100 }))

const ALL_DOORS = [...DOORS_LOOP1, ...DOORS_LOOP2]

export function LabScene() {
  const [activeRoom, setActiveRoom] = useState<RoomId>(null)
  const [paperOpen, setPaperOpen] = useState(false)
  const [pendingRoom, setPendingRoom] = useState<RoomId>(null)
  const [isInCorridor, setIsInCorridor] = useState(true)

  useEffect(() => {
    audioManager.init()
    audioManager.playBg()
    return () => audioManager.stopBg()
  }, [])

  const handleEnterRoom = useCallback((room: RoomId) => {
    audioManager.stopBg()
    setPendingRoom(room)
    setPaperOpen(true)   // close paper over corridor
  }, [])

  const handlePaperClosed = useCallback(() => {
    // Paper is fully closed — switch to room content
    setIsInCorridor(false)
    setActiveRoom(pendingRoom)
    setPaperOpen(false)  // start opening paper to reveal room
  }, [pendingRoom])

  const handleCloseRoom = useCallback(() => {
    setPendingRoom(null)
    setPaperOpen(true)   // close paper over room
  }, [])

  const handlePaperClosedOnExit = useCallback(() => {
    setActiveRoom(null)
    setPaperOpen(false)  // reveal corridor
    audioManager.playBg()
  }, [])

  // Stable callback — avoids new reference each render (which would restart GSAP tween)
  const onPaperClosed = useCallback(() => {
    if (activeRoom) {
      handlePaperClosedOnExit()
    } else {
      handlePaperClosed()
    }
  }, [activeRoom, handlePaperClosed, handlePaperClosedOnExit])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0ece4' }}>
      {/* 3D Corridor Canvas */}
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <CameraController scrollEnabled={!activeRoom && !paperOpen} />
          <CorridorGeometry />
          {ALL_DOORS.map((door) => (
            <CorridorDoor
              key={`${door.room}-${door.z}`}
              position={[door.side === 'left' ? -3.5 : 3.5, 0, door.z]}
              side={door.side}
              type={door.type}
              label={door.label}
              onEnter={() => handleEnterRoom(door.room)}
              isReset={isInCorridor}
            />
          ))}
          <HeroText visible={isInCorridor} position={[0, 0.3, -4]} />
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
        </Suspense>
      </Canvas>

      {/* Scroll hint — text stays HTML, name is now in 3D HeroText */}
      {isInCorridor && (
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
      {isInCorridor && (
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

      {/* Room overlay */}
      <RoomOverlay
        room={activeRoom}
        onClose={handleCloseRoom}
      />

      {/* Paper transition */}
      <PaperTransition
        isOpen={paperOpen}
        onClosed={onPaperClosed}
        onOpened={() => setIsInCorridor(true)}
      />

      {/* Audio toggle — always visible */}
      <AudioToggle />
    </div>
  )
}
