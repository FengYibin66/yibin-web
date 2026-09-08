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
import { ResidentCat } from './companions/ResidentCat'
import { useLabLabels } from '@/hooks/useLabLabels'
import { SEGMENT_LENGTH, doorWallX, segmentStartZ } from '@/lib/lab/domain/corridor/layout'
import { landmarksInSegment, type Landmark } from '@/lib/lab/domain/corridor/landmarks'

/**
 * 走廊内容 = 遍历地标声明（ADR 20260908172231）。
 *
 * 加一样东西是往 `domain/corridor/landmarks.ts` 里加一项 + 在下面的 `switch`
 * 里给它一个渲染分支，**不是**在这里堆一段带坐标的 JSX。同一条纪律见
 * `components/rooms/projects/AGENTS.md`：「加一块墙面装饰是往声明里加一项」。
 *
 * 本文件原先自带一份 `SEGMENT_DOORS` + 段号计算，而 `useCorridorCamera`、
 * `TeleportRoom`、`corridorMurals` 各有一份同样的坐标——改一个门位要同步改四处，
 * 漏改不报错，只会让传送落到错误的位置或壁画压在门上（审计 B3）。`layout.ts`
 * 收掉了那一轮重复，地标表收掉的是「按类型分表」带来的下一轮。
 */
function renderLandmark(
  landmark: Landmark,
  context: {
    zStart: number
    segmentIndex: number
    doorLabels: Record<string, string>
    setCameraOverride: (active: boolean) => void
  },
) {
  const { zStart, segmentIndex, doorLabels, setCameraOverride } = context
  const z = zStart + landmark.relativeZ

  switch (landmark.kind) {
    /*
      门牌文案来自 `content[locale].labUi.doors`（审计 E7 已修）：这里原先是
      一张硬编码英文表。索引用 roomId，所以加一个房间不需要改这里。
    */
    case 'door':
      return (
        <DoorSection
          key={landmark.id}
          position={[doorWallX(landmark.side), 0, z]}
          side={landmark.side}
          type={landmark.textureType}
          label={doorLabels[landmark.roomId] ?? landmark.roomId}
          roomId={landmark.roomId}
          segmentIndex={segmentIndex}
          setCameraOverride={setCameraOverride}
        />
      )

    /*
      欢迎区：HeroText 在 Avatar 后面（z −0.5 < −0.3），是 itomdev 原版的层次。
      三者共用一个 group，所以它们是**一个**地标而不是三个。
    */
    case 'hero':
      return (
        <group key={landmark.id} position={[0, 0, z]}>
          <HeroText visible={true} position={[0, -0.1, -0.5]} />
          <Avatar position={[0, -0.61, -0.3]} />
          <Doodles offsetZ={0} />
        </group>
      )

    case 'easter':
      return <BugEaster key={landmark.id} position={[0, 0, z]} />

    case 'segment-door':
      return <SegmentDoor key={landmark.id} position={[0, 0, z]} />

    /*
      活物驻点。目前只有守相框的猫（ADR 20260908160918）——它坐在柜子顶上，
      所以 x / y 由 `ResidentCat` 按走廊几何自己算，这里只给 z 与墙面。
    */
    case 'companion-anchor':
      return <ResidentCat key={landmark.id} z={z} side={landmark.side} />

    /*
      家具由 `CorridorDecorations` 统一渲染（它还管吊灯与壁画，而壁画的位置
      要避开家具——两者在同一个组件里才好保证）。地标表里的家具条目负责
      声明位置与避让半径，不在这里出 JSX。
    */
    case 'furniture':
      return null

    // 第 3 期：窗（三扇窗三座城）/ 年份刻度（时间线墙）
    case 'window':
    case 'year-mark':
      return null
  }
}

interface CorridorSegmentProps {
  segmentIndex: number
  setCameraOverride: (active: boolean) => void
}

function CorridorSegmentInner({ segmentIndex, setCameraOverride }: CorridorSegmentProps) {
  const labels = useLabLabels()
  const zStart = segmentStartZ(segmentIndex)

  return (
    <group>
      {/* ── Corridor geometry (walls, floor, ceiling, lights) ── */}
      <CorridorGeometry zStart={zStart} length={SEGMENT_LENGTH} />

      {landmarksInSegment(segmentIndex).map(landmark =>
        renderLandmark(landmark, {
          zStart,
          segmentIndex,
          doorLabels: labels.doors,
          setCameraOverride,
        }),
      )}

      {/* ── Wall decorations (paintings, plants, lamps) ── */}
      <CorridorDecorations
        zOffset={zStart}
        segmentIndex={segmentIndex}
        setCameraOverride={setCameraOverride}
      />
    </group>
  )
}

export const CorridorSegment = memo(CorridorSegmentInner)
