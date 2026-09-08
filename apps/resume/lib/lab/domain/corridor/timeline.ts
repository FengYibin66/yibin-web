/**
 * 走廊时间线（ADR 20260908204303，规格 lab-corridor-story.md §2）。
 *
 * 一条**声明**：第 0 段 −6 → −90 线性铺 2017 → 2026。年份刻度与履历便签的位置
 * 全部由它**派生**，不手写坐标；落点按门 / 家具 / 窗 / 段末门的位置避让，
 * 规则是确定性的，`timelinePlacement.test.ts` 对全部条目断言零重叠。
 *
 * 这个文件不 import `landmarks.ts`（那边要用这里的派生函数生成 year-mark 条目），
 * 障碍物直接读 `layout.ts` 的常量。
 */

import type { WallSide } from '../ids'
import {
  CORRIDOR_DOORS,
  CORRIDOR_FURNITURE,
  CORRIDOR_WINDOWS,
  SEGMENT_DOOR_RELATIVE_Z,
} from './layout'

export const TIMELINE = {
  startYear: 2017,
  endYear: 2026,
  fromRelativeZ: -6,
  toRelativeZ: -90,
} as const

/** 年份刻度：同侧这么近有门 / 家具就换墙 */
export const YEAR_MARK_CLEARANCE = 3.5
/** 段末门的避让半径（与地标表 segment-door 的 keepOut 同值） */
const SEGMENT_DOOR_KEEP = 5.5
/** 便签：同侧这么近有门就换墙（门龛半宽 2 + 边距 4.5，与壁画的 DOOR_KEEP_RADIUS 同值） */
export const NOTE_DOOR_CLEARANCE = 6.5
/** 便签：同侧与窗的最小间距（窗半宽 0.75 + 便签半宽 0.7 + 缝） */
export const NOTE_WINDOW_CLEARANCE = 1.6
/** 便签：同侧两张之间的最小间距 */
export const NOTE_MIN_GAP = 2.4

export function relativeZOfYear(year: number): number {
  const { startYear, endYear, fromRelativeZ, toRelativeZ } = TIMELINE
  const t = (year - startYear) / (endYear - startYear)
  return fromRelativeZ + t * (toRelativeZ - fromRelativeZ)
}

export function yearAt(relativeZ: number): number {
  const { startYear, endYear, fromRelativeZ, toRelativeZ } = TIMELINE
  const t = (relativeZ - fromRelativeZ) / (toRelativeZ - fromRelativeZ)
  return startYear + t * (endYear - startYear)
}

export function timelineYears(): readonly number[] {
  const years: number[] = []
  for (let y = TIMELINE.startYear; y <= TIMELINE.endYear; y += 1) years.push(y)
  return years
}

// ── 障碍物 ─────────────────────────────────────────────────────────────────

interface Obstacle {
  readonly side: WallSide
  readonly relativeZ: number
}

const DOORS: readonly Obstacle[] = CORRIDOR_DOORS.map(d => ({ side: d.side, relativeZ: d.relativeZ }))
const FURNITURE: readonly Obstacle[] = CORRIDOR_FURNITURE.map(f => ({ side: f.side, relativeZ: f.relativeZ }))
const WINDOWS: readonly Obstacle[] = CORRIDOR_WINDOWS.map(w => ({ side: w.side, relativeZ: w.relativeZ }))

function nearest(list: readonly Obstacle[], side: WallSide, z: number): number {
  let best = Number.POSITIVE_INFINITY
  for (const o of list) {
    if (o.side !== side) continue
    best = Math.min(best, Math.abs(o.relativeZ - z))
  }
  return best
}

/** 落进段末门避让区就贴到区外 */
function clampOutOfSegmentDoor(z: number): number {
  const edge = SEGMENT_DOOR_RELATIVE_Z + SEGMENT_DOOR_KEEP
  return z < edge + 0.5 ? edge + 0.5 : z
}

// ── 年份刻度 ────────────────────────────────────────────────────────────────

export interface YearMarkPlacement {
  readonly year: number
  readonly relativeZ: number
  readonly side: WallSide
}

/**
 * 规格 §2.2：优先左墙；同侧 3.5 单位内有门或家具 → 换右墙；两侧都有 → 取更远的一侧；
 * 落进段末门避让区 → 贴边。
 */
export function placeYearMarks(): readonly YearMarkPlacement[] {
  return timelineYears().map(year => {
    const z = clampOutOfSegmentDoor(relativeZOfYear(year))
    const blockers = [...DOORS, ...FURNITURE]
    const left = nearest(blockers, 'left', z)
    const right = nearest(blockers, 'right', z)
    let side: WallSide = 'left'
    if (left < YEAR_MARK_CLEARANCE) {
      side = right < YEAR_MARK_CLEARANCE ? (left >= right ? 'left' : 'right') : 'right'
    }
    return { year, relativeZ: Math.round(z * 10) / 10, side }
  })
}

// ── 履历便签 ────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  readonly id: string
  readonly years: { readonly start: number; readonly end?: number }
}

export interface TimelineNotePlacement {
  readonly id: string
  readonly relativeZ: number
  readonly side: WallSide
}

/** 便签挂在哪一年：起点往后最多半年 */
export function noteYear(entry: TimelineEntry): number {
  const end = entry.years.end ?? TIMELINE.endYear
  const span = Math.max(0, end - entry.years.start)
  return entry.years.start + Math.min(span, 1) / 2
}

/**
 * 规格 §2.3：z 取 `noteYear`；侧别取没有门在 6.5 内的那面墙（都没有 → 与上一张相反；
 * 都有 → 门更远的那面）；再避开同侧的窗；同侧两张 < 2.4 → 沿 −z 推。
 * 输入顺序不影响结果：先按年份排序再放。
 */
export function placeTimelineNotes(entries: readonly TimelineEntry[]): readonly TimelineNotePlacement[] {
  const sorted = [...entries].sort((a, b) => noteYear(a) - noteYear(b) || a.id.localeCompare(b.id))
  const placed: TimelineNotePlacement[] = []
  let previousSide: WallSide = 'right'

  for (const entry of sorted) {
    let z = clampOutOfSegmentDoor(relativeZOfYear(noteYear(entry)))

    const leftDoor = nearest(DOORS, 'left', z)
    const rightDoor = nearest(DOORS, 'right', z)
    let side: WallSide
    if (leftDoor >= NOTE_DOOR_CLEARANCE && rightDoor >= NOTE_DOOR_CLEARANCE) {
      side = previousSide === 'left' ? 'right' : 'left'
    } else if (leftDoor >= NOTE_DOOR_CLEARANCE) {
      side = 'left'
    } else if (rightDoor >= NOTE_DOOR_CLEARANCE) {
      side = 'right'
    } else {
      side = leftDoor >= rightDoor ? 'left' : 'right'
    }

    // 沿 −z 推，直到与同侧的窗、同侧已放的便签都拉开距离（单调推进，必然终止）
    for (let guard = 0; guard < 40; guard += 1) {
      let moved = false
      if (nearest(WINDOWS, side, z) < NOTE_WINDOW_CLEARANCE) {
        z -= 0.4
        moved = true
      }
      for (const p of placed) {
        if (p.side === side && Math.abs(p.relativeZ - z) < NOTE_MIN_GAP && z > p.relativeZ - NOTE_MIN_GAP) {
          z = p.relativeZ - NOTE_MIN_GAP
          moved = true
        }
      }
      if (!moved) break
    }

    z = Math.round(z * 10) / 10
    placed.push({ id: entry.id, relativeZ: z, side })
    previousSide = side
  }
  return placed
}
