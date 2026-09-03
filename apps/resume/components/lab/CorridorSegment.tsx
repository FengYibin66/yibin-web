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
import type { RoomId } from '@/lib/lab/domain/ids'
import {
  BUG_RELATIVE_Z,
  CORRIDOR_DOORS,
  SEGMENT_DOOR_RELATIVE_Z,
  SEGMENT_LENGTH,
  doorWallX,
  segmentStartZ,
} from '@/lib/lab/domain/corridor/layout'

/**
 * 几何常量全部来自 `lib/lab/domain/corridor/layout`（ADR 20260903140615）。
 *
 * 本文件原先自带一份 `SEGMENT_DOORS` + `SEGMENT_LENGTH` + `segmentZStart`，
 * 而 `useCorridorCamera`、`TeleportRoom`、`corridorMurals` 各有一份同样的
 * 坐标——改一个门位要同步改四处，漏改不报错，只会让传送落到错误的位置或
 * 壁画压在门上（审计 B3）。
 */

/**
 * 门牌文案的临时兜底。
 *
 * 目前 Lab 全部 DOM 与 3D 文案都是硬编码英文，中文用户看到的是"门牌、地图、
 * 加载提示全英文，房间内容却是中文"（审计 E7）。ADR 20260903140619 的
 * `content[locale].lab.doors` 会取代这里；`RoomDefinition.labelKey` 已经预留
 * 了 key。
 */
const FALLBACK_DOOR_LABELS: Record<RoomId, string> = {
  about: 'About',
  projects: 'Projects',
  publications: 'Publications',
  gallery: 'Gallery',
  contact: 'Contact',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CorridorSegmentProps {
  segmentIndex: number
  setCameraOverride: (active: boolean) => void
}

function CorridorSegmentInner({ segmentIndex, setCameraOverride }: CorridorSegmentProps) {
  const zStart = segmentStartZ(segmentIndex)

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
      {CORRIDOR_DOORS.map((door) => (
        <DoorSection
          key={`${door.roomId}-${segmentIndex}`}
          position={[doorWallX(door.side), 0, zStart + door.relativeZ]}
          side={door.side}
          type={door.textureType}
          label={FALLBACK_DOOR_LABELS[door.roomId]}
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
      <SegmentDoor position={[0, 0, zStart + SEGMENT_DOOR_RELATIVE_Z]} />
    </group>
  )
}

export const CorridorSegment = memo(CorridorSegmentInner)
