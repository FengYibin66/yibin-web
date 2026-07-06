'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CorridorGeometry } from './CorridorGeometry'
import { CorridorDoor } from './CorridorDoor'
import { RoomOverlay } from './RoomOverlay'
import { PaperTransition } from './PaperTransition'
import { AudioToggle } from './AudioToggle'
import { useCorridorCamera } from '@/hooks/useCorridorCamera'
import { audioManager } from '@/lib/audio/audioManager'

type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact' | null

// Camera controller inside Canvas context
function CameraController({ scrollEnabled }: { scrollEnabled: boolean }) {
  useCorridorCamera({ smoothing: 0.035, scrollSpeed: 0.02, scrollEnabled })
  return null
}

const DOORS = [
  { z: -18 as const, side: 'left'  as const, type: 'about',    label: 'About',        room: 'about'        as const },
  { z: -32 as const, side: 'right' as const, type: 'projekty', label: 'Projects',     room: 'projects'     as const },
  { z: -48 as const, side: 'left'  as const, type: 'kontakt',  label: 'Publications', room: 'publications' as const },
  { z: -62 as const, side: 'right' as const, type: 'social',   label: 'Gallery',      room: 'gallery'      as const },
  { z: -75 as const, side: 'left'  as const, type: 'kontakt',  label: 'Contact',      room: 'contact'      as const },
]

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
    <div style={{ width: '100vw', height: '100vh', background: '#1a1208' }}>
      {/* 3D Corridor Canvas */}
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <CameraController scrollEnabled={!activeRoom && !paperOpen} />
          <CorridorGeometry />
          {DOORS.map((door) => (
            <CorridorDoor
              key={door.room}
              position={[door.side === 'left' ? -3.5 : 3.5, 0, door.z]}
              side={door.side}
              type={door.type}
              label={door.label}
              onEnter={() => handleEnterRoom(door.room)}
              isReset={isInCorridor}
            />
          ))}
        </Suspense>
      </Canvas>

      {/* Hero text overlay in corridor */}
      {isInCorridor && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(200,169,110,0.6)', marginBottom: '8px' }}>
            SCROLL TO EXPLORE
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, color: '#f5f0e8', margin: 0 }}>
            Yibin Feng
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'rgba(245,240,232,0.5)', marginTop: '8px', letterSpacing: '0.15em' }}>
            AI Engineer · Researcher · Builder
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
