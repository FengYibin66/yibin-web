'use client'

import { useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CorridorSegment, SEGMENT_LENGTH, segmentZStart } from './CorridorSegment'

interface InfiniteCorridorManagerProps {
  setCameraOverride: (active: boolean) => void
}

/**
 * Dynamically mounts the segment the camera is in plus one segment ahead and one behind.
 * As the camera walks forward (toward -Z), new segments are mounted; passed segments unmount.
 * This creates the illusion of an infinite corridor with no hard end.
 *
 * Segment index derivation:
 *   segmentIndex = floor((10 - cameraZ) / SEGMENT_LENGTH)
 *   - Camera at Z=10  → segment 0
 *   - Camera at Z=-90 → segment 1
 *   - Camera at Z=-190 → segment 2, ...
 */
export function InfiniteCorridorManager({ setCameraOverride }: InfiniteCorridorManagerProps) {
  const { camera } = useThree()

  // Active segment indices — starts with [0, 1] so shaders compile during preloader
  const [activeSegments, setActiveSegments] = useState<number[]>([0, 1])
  const lastSegmentRef = useRef<number>(0)

  useFrame(() => {
    const currentSeg = Math.floor((10 - camera.position.z) / SEGMENT_LENGTH)

    if (currentSeg === lastSegmentRef.current) return
    lastSegmentRef.current = currentSeg

    // Keep previous, current, and next segment mounted
    setActiveSegments([currentSeg - 1, currentSeg, currentSeg + 1])
  })

  return (
    <group>
      {activeSegments.map((index) => {
        return (
          <SegmentVisibilityGate
            key={`seg-${index}`}
            segmentIndex={index}
            setCameraOverride={setCameraOverride}
          />
        )
      })}
    </group>
  )
}

// ─── Visibility gate ──────────────────────────────────────────────────────────
// Hides segments fully behind the camera to cut draw calls.

interface SegmentVisibilityGateProps {
  segmentIndex: number
  setCameraOverride: (active: boolean) => void
}

function SegmentVisibilityGate({ segmentIndex, setCameraOverride }: SegmentVisibilityGateProps) {
  const { camera } = useThree()
  const groupRef = useRef<import('three').Group>(null)

  const zStart = segmentZStart(segmentIndex)
  const zEnd   = zStart - SEGMENT_LENGTH

  useFrame(() => {
    if (!groupRef.current) return
    // Show segment only when camera is within ±30 units of its Z range
    const camZ = camera.position.z
    const visible = camZ < zStart + 30 && camZ > zEnd - 5
    if (groupRef.current.visible !== visible) {
      groupRef.current.visible = visible
    }
  })

  return (
    <group ref={groupRef}>
      <CorridorSegment segmentIndex={segmentIndex} setCameraOverride={setCameraOverride} />
    </group>
  )
}
