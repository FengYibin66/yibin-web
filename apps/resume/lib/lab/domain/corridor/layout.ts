import type { DoorSlot, DoorTextureType, RoomId, WallSide } from '../ids'

/**
 * 走廊几何 —— 门位与装饰坐标的唯一来源。
 *
 * 加它的原因（审计 B3）：同一组门的 Z 坐标原先在**四个地方**各写一份：
 *
 * - `components/lab/CorridorSegment.tsx` 的 `SEGMENT_DOORS`（渲染门）
 * - `hooks/useCorridorCamera.ts` 的 `DOOR_RELATIVE_POSITIONS`（相机侧扫）
 * - `components/lab/TeleportRoom.tsx` 的 `ROOM_DOOR_Z`（传送落点）
 * - `lib/lab/corridorMurals.ts` 的 `MURAL_KEEP_OUTS`（壁画避让）
 *
 * 加上「相机在第几段」这个计算的三份拷贝——两处写
 * `Math.floor((10 - cameraZ) / SEGMENT_LENGTH)`，`DoorSection` 里还有一个
 * 裸 `/ 100`。改一个门位要同步改四到七处，漏改不报错，只会让传送落到错误
 * 的位置、或壁画压在门上。
 *
 * `MURAL_KEEP_OUTS` 暂未迁入：它带着自己的一套避让语义与既有单测，属于
 * ADR 20260903140615 的后续步骤。本文件先消灭前三处 + 段号计算。
 */

export interface CorridorDoorPlacement {
  slot: DoorSlot
  roomId: RoomId
  /** 段内相对 Z（负数，越小越深） */
  relativeZ: number
  side: WallSide
  textureType: DoorTextureType
}

export interface CorridorFurniturePlacement {
  kind: 'desk' | 'cabinet' | 'potted-tree'
  relativeZ: number
  side: WallSide
}

/** 段长。走廊在 Z 轴上无限延伸，每段结构相同。 */
export const SEGMENT_LENGTH = 100

/** 第 0 段的起点 Z（朝向相机的那一端）。相机初始位置在 Z=28。 */
export const FIRST_SEGMENT_START_Z = 10

/** 门所在墙面的 X 绝对值 */
export const WALL_X = 3.5

export const CORRIDOR_DOORS: readonly CorridorDoorPlacement[] = [
  { slot: 0, roomId: 'about', relativeZ: -8, side: 'left', textureType: 'about' },
  { slot: 1, roomId: 'projects', relativeZ: -20, side: 'right', textureType: 'projekty' },
  { slot: 2, roomId: 'publications', relativeZ: -32, side: 'left', textureType: 'kontakt' },
  { slot: 3, roomId: 'gallery', relativeZ: -44, side: 'right', textureType: 'social' },
  { slot: 4, roomId: 'contact', relativeZ: -56, side: 'left', textureType: 'kontakt' },
] as const

export const CORRIDOR_FURNITURE: readonly CorridorFurniturePlacement[] = [
  { kind: 'desk', relativeZ: -27, side: 'left' },
  { kind: 'cabinet', relativeZ: -49, side: 'right' },
  { kind: 'potted-tree', relativeZ: -63, side: 'left' },
] as const

/** 欢迎区（HeroText + Avatar + Doodles）在段内的位置 */
export const HERO_RELATIVE_Z = -2

/** bug 彩蛋 */
export const BUG_RELATIVE_Z = -70

/** 段末的双开门（通往下一段） */
export const SEGMENT_DOOR_RELATIVE_Z = -95

/** 吊灯：从 firstRelativeZ 起每隔 spacing 一盏，直到超过 lastRelativeZ */
export const LAMP_LAYOUT = { firstRelativeZ: -5, spacing: 15, lastRelativeZ: -90 } as const

// ─── 派生计算 ────────────────────────────────────────────────────────────────

/** 第 index 段起点的世界 Z */
export function segmentStartZ(index: number): number {
  return FIRST_SEGMENT_START_Z - index * SEGMENT_LENGTH
}

/**
 * 相机所在的段号。
 *
 * 原先这个式子在三处各写一份（其中一处是裸 `/ 100`）。它是**唯一**该出现
 * 的地方——段长若改动，改不到的那处会静默算错段号，表现为传送落到错误位置
 * 或走廊段挂载错位。
 */
export function segmentIndexAtZ(cameraZ: number): number {
  return Math.floor((FIRST_SEGMENT_START_Z - cameraZ) / SEGMENT_LENGTH)
}

/** 某段里某个门位的世界 Z */
export function doorWorldZ(slot: DoorSlot, segmentIndex: number): number {
  const door = CORRIDOR_DOORS.find(d => d.slot === slot)
  if (!door) throw new RangeError(`未知门位 slot=${slot}`)
  return segmentStartZ(segmentIndex) + door.relativeZ
}

/** 某个房间对应的门 */
export function doorForRoom(roomId: RoomId): CorridorDoorPlacement {
  const door = CORRIDOR_DOORS.find(d => d.roomId === roomId)
  if (!door) throw new RangeError(`房间 ${roomId} 没有对应的门`)
  return door
}

/** 门所在墙面的世界 X（左墙为负） */
export function doorWallX(side: WallSide): number {
  return side === 'left' ? -WALL_X : WALL_X
}

/** 某段里的吊灯世界 Z 列表 */
export function lampZsForSegment(segmentIndex: number): number[] {
  const start = segmentStartZ(segmentIndex)
  const zs: number[] = []
  for (
    let relative = LAMP_LAYOUT.firstRelativeZ;
    relative > LAMP_LAYOUT.lastRelativeZ;
    relative -= LAMP_LAYOUT.spacing
  ) {
    zs.push(start + relative)
  }
  return zs
}
