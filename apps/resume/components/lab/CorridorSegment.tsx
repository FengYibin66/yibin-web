'use client'

import { memo } from 'react'
import { CorridorGeometry } from './CorridorGeometry'
import { DoorSection } from './DoorSection'
import { SegmentDoor } from './SegmentDoor'
import { CorridorDecorations } from './CorridorDecorations'
import { BugEaster } from './BugEaster'
import { Avatar } from './Avatar'
import { HeroText } from './HeroText'
import { Doodles } from './Doodles'
import type { RoomId } from '@/context/SceneContext'

// ─── Segment geometry constants ───────────────────────────────────────────────

/** Total Z-length of one corridor segment */
export const SEGMENT_LENGTH = 100

/**
 * Z coordinate of segment `index`'s start (camera-facing end).
 * Segment 0 starts at Z=10, segment 1 at Z=-90, segment 2 at Z=-190, ...
 */
export function segmentZStart(index: number): number {
  return 10 - index * SEGMENT_LENGTH
}

// ─── Door layout within a segment (relative to segment start) ─────────────────

interface DoorDef {
  relativeZ: number
  side: 'left' | 'right'
  type: string
  label: string
  roomId: RoomId
}

const SEGMENT_DOORS: DoorDef[] = [
  { relativeZ:  -8, side: 'left',  type: 'about',    label: 'About',        roomId: 'about'        },
  { relativeZ: -20, side: 'right', type: 'projekty',  label: 'Projects',     roomId: 'projects'     },
  { relativeZ: -32, side: 'left',  type: 'kontakt',   label: 'Publications', roomId: 'publications' },
  { relativeZ: -44, side: 'right', type: 'social',    label: 'Gallery',      roomId: 'gallery'      },
  { relativeZ: -56, side: 'left',  type: 'kontakt',   label: 'Contact',      roomId: 'contact'      },
]

/** X position of each door's wall anchor */
const DOOR_WALL_X = 3.5

// ─── BugEaster Z positions within a segment (relative to segment start) ───────
const BUG_RELATIVE_Z = -70

// ─── Component ────────────────────────────────────────────────────────────────

interface CorridorSegmentProps {
  segmentIndex: number
  setCameraOverride: (active: boolean) => void
}

function CorridorSegmentInner({ segmentIndex, setCameraOverride }: CorridorSegmentProps) {
  const zStart = segmentZStart(segmentIndex)

  return (
    <group>
      {/* ── Corridor geometry (walls, floor, ceiling, lights) ── */}
      <CorridorGeometry zStart={zStart} length={SEGMENT_LENGTH} />

      {/* ── Welcome area — exact itomdev layout ──
          group at zStart-2, HeroText behind Avatar (z=-0.5 < z=-0.3) */}
      <group position={[0, 0, zStart - 2]}>
        <HeroText visible={true} position={[0, -0.1, -0.5]} />
        <Avatar position={[0, -0.61, -0.3]} />
        <Doodles offsetZ={0} />
      </group>

      {/* ── Door sections ── */}
      {SEGMENT_DOORS.map((door) => (
        <DoorSection
          key={`${door.roomId}-${segmentIndex}`}
          position={[door.side === 'left' ? -DOOR_WALL_X : DOOR_WALL_X, 0, zStart + door.relativeZ]}
          side={door.side}
          type={door.type}
          label={door.label}
          roomId={door.roomId}
          segmentIndex={segmentIndex}
          setCameraOverride={setCameraOverride}
        />
      ))}

      {/* ── Wall decorations (paintings, plants, lamps) ── */}
      <CorridorDecorations
        zOffset={zStart}
        segmentIndex={segmentIndex}
        setCameraOverride={setCameraOverride}
      />

      {/* ── Bug easter egg ── */}
      <BugEaster position={[0, 0, zStart + BUG_RELATIVE_Z]} />

      {/* ── Segment transition door at the end ── */}
      <SegmentDoor position={[0, 0, zStart - SEGMENT_LENGTH + 5]} />
    </group>
  )
}

export const CorridorSegment = memo(CorridorSegmentInner)
