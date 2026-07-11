'use client'

import { useEffect } from 'react'
import { Text } from '@react-three/drei'
import type { RoomId } from '@/context/SceneContext'

interface RoomInteriorProps {
  roomId: RoomId
  showRoom: boolean
  onReady: () => void
  isExiting: boolean
}

const ROOM_LABELS: Record<RoomId, string> = {
  about:        'About',
  projects:     'Projects',
  publications: 'Publications',
  gallery:      'Gallery',
  contact:      'Contact',
}

export function RoomInterior({ roomId, onReady }: RoomInteriorProps) {
  // Notify parent that room is ready (short delay to simulate mounting)
  useEffect(() => {
    const timer = setTimeout(onReady, 100)
    return () => clearTimeout(timer)
  }, [onReady])

  return (
    <group>
      {/* Simple box room placeholder — Phase 9 will replace with real 3D room */}
      <mesh position={[0, 0, -20]}>
        <boxGeometry args={[10, 6, 20]} />
        <meshBasicMaterial color="#f0ece4" side={2} />
      </mesh>
      {/* Room title */}
      <Text
        position={[0, 0, -15]}
        fontSize={0.8}
        color="#2a1f0e"
        font="/fonts/CabinSketch-Bold.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {ROOM_LABELS[roomId]}
      </Text>
      {/* ESC hint */}
      <Text
        position={[0, -1.2, -15]}
        fontSize={0.2}
        color="#8b7355"
        font="/fonts/CabinSketch-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        Press ESC to return
      </Text>
    </group>
  )
}
