'use client'

import { useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CorridorSegment } from './CorridorSegment'
import {
  SEGMENT_LENGTH,
  segmentIndexAtZ,
  segmentStartZ,
} from '@/lib/lab/domain/corridor/layout'

interface InfiniteCorridorManagerProps {
  setCameraOverride: (active: boolean) => void
}

/**
 * Dynamically mounts the segment the camera is in plus one segment ahead and one behind.
 * As the camera walks forward (toward -Z), new segments are mounted; passed segments unmount.
 * This creates the illusion of an infinite corridor with no hard end.
 *
 * 段号由 `segmentIndexAtZ`（lib/lab/domain/corridor/layout）给出——那是唯一
 * 该出现这个式子的地方。相机 Z=10 → 第 0 段，Z=−90 → 第 1 段，以此类推。
 */
export function InfiniteCorridorManager({ setCameraOverride }: InfiniteCorridorManagerProps) {
  const { camera } = useThree()

  /**
   * 初始挂载的段。
   *
   * 原先是 `[0, 1]`，注释写着「让第 1 段在 loader 期间编译 shader」——但相机
   * 初始在 Z=28，`segmentIndexAtZ(28)` 是 −1，于是第一帧就把它换成
   * `[-2, -1, 0]`，第 1 段**立刻卸载**，用户走到 Z=10 时再重新挂载，产生一次
   * 卡顿（审计 G5：注释与实现不符）。改为与第一帧的计算一致。
   */
  const initialSegment = segmentIndexAtZ(camera.position.z)
  const [activeSegments, setActiveSegments] = useState<number[]>(() => [
    initialSegment - 1,
    initialSegment,
    initialSegment + 1,
  ])
  const lastSegmentRef = useRef<number>(initialSegment)

  useFrame(() => {
    // 段号计算只有 domain 一处（原先这个式子在三处各写一份，其中一处是裸 /100）
    const currentSeg = segmentIndexAtZ(camera.position.z)

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

  const zStart = segmentStartZ(segmentIndex)
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
