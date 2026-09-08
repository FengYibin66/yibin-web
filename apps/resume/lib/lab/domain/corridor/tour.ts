/**
 * 招聘官路线「带我走一遍」（ADR 20260908204302，规格 lab-corridor-story.md §5）。
 *
 * 路线是**纯数据 + 纯函数**：停靠点引用地标表的 id（坐标由地标派生，不重复），
 * `tourPlan()` 把它展开成一串「滚到哪、走多久、停多久、说哪句」。控制器
 * （`hooks/useTour.ts`）只负责按计划调导轨命令；相机一下都不碰。
 *
 * 60 秒是硬约束：`tourTotalMs()` 由单测守。
 */

import { landmarkById } from './landmarks'
import { segmentStartZ } from './layout'

export interface TourStop {
  readonly id: string
  readonly landmarkId: string
  /** 停在地标前方几单位（+z 方向，玩家来的方向） */
  readonly standOff: number
  readonly dwellMs: number
  readonly captionKey: TourCaptionKey
}

export type TourCaptionKey =
  | 'welcome'
  | 'about'
  | 'projects'
  | 'publications'
  | 'gallery'
  | 'contact'
  | 'cat'
  | 'end'

/**
 * 门前 standOff = 7 落在门自动侧目的峭峰（`useCorridorCamera` 的 GLANCE_PEAK_DIST = 8）
 * 附近，相机会自然转向那扇门——不另写相机。
 */
export const TOUR_STOPS: readonly TourStop[] = [
  { id: 'welcome', landmarkId: 'welcome-avatar', standOff: 5, dwellMs: 4000, captionKey: 'welcome' },
  { id: 'about', landmarkId: 'door-about', standOff: 7, dwellMs: 4000, captionKey: 'about' },
  { id: 'projects', landmarkId: 'door-projects', standOff: 7, dwellMs: 4000, captionKey: 'projects' },
  { id: 'publications', landmarkId: 'door-publications', standOff: 7, dwellMs: 4000, captionKey: 'publications' },
  { id: 'gallery', landmarkId: 'door-gallery', standOff: 7, dwellMs: 4000, captionKey: 'gallery' },
  { id: 'contact', landmarkId: 'door-contact', standOff: 7, dwellMs: 4000, captionKey: 'contact' },
  { id: 'cat', landmarkId: 'resident-cat', standOff: 6, dwellMs: 3000, captionKey: 'cat' },
  { id: 'end', landmarkId: 'segment-door', standOff: 8, dwellMs: 5000, captionKey: 'end' },
]

/**
 * 世界单位 / 秒。从起点 28 到段末门前共 105 单位（规格初稿估成 84）：
 * 3 u/s 是 35 s + 32 s 停留 = 67 s，超 60；4 u/s 是 26 s，合计 58 s。
 */
export const TOUR_SPEED = 4
/** reduced motion 下慢一点：路线仍可用（用户主动发起的导航），只是不赶。35 + 32 = 67 s ≤ 75 */
export const TOUR_SPEED_REDUCED = 3
export const TOUR_MAX_MS = 60_000
export const TOUR_MAX_MS_REDUCED = 75_000

export interface TourLeg {
  readonly stop: TourStop
  /** 世界 z */
  readonly targetZ: number
  readonly travelMs: number
  readonly dwellMs: number
}

/** 停靠点的世界 z（第 segmentIndex 段） */
export function tourStopZ(stop: TourStop, segmentIndex: number): number {
  const landmark = landmarkById(stop.landmarkId)
  if (!landmark) throw new RangeError(`路线停靠点 ${stop.id} 引用了不存在的地标 ${stop.landmarkId}`)
  return segmentStartZ(segmentIndex) + landmark.relativeZ + stop.standOff
}

/** 这一站的地标在第 segmentIndex 段出现吗（猫只在第 0 段） */
export function tourStopInSegment(stop: TourStop, segmentIndex: number): boolean {
  const landmark = landmarkById(stop.landmarkId)
  if (!landmark) return false
  return landmark.segments === 'all' || landmark.segments.includes(segmentIndex)
}

function planSegment(fromZ: number, segmentIndex: number, speed: number): TourLeg[] {
  const legs: TourLeg[] = []
  let z = fromZ
  for (const stop of TOUR_STOPS) {
    if (!tourStopInSegment(stop, segmentIndex)) continue
    const targetZ = tourStopZ(stop, segmentIndex)
    if (targetZ > z - 0.5) continue // 已经过了
    const travelMs = Math.round((Math.abs(z - targetZ) / speed) * 1000)
    legs.push({ stop, targetZ, travelMs, dwellMs: stop.dwellMs })
    z = targetZ
  }
  return legs
}

/**
 * 从 `fromZ` 出发的完整计划。行进时间 = 距离 / 速度；停靠点已经在身后的
 * （fromZ 比目标更靠前）跳过——路线从玩家所在处开始，不倒着走。
 *
 * 本段已经没有前方的停靠点（站在段末门前再按一次）→ 计划**下一段**：
 * 走廊无限延伸，"再走一圈"就是字面意思。实测第一版在这里返回空计划，
 * 路线开始的同一毫秒就结束了。
 */
export function tourPlan(fromZ: number, segmentIndex: number, reduced = false): readonly TourLeg[] {
  const speed = reduced ? TOUR_SPEED_REDUCED : TOUR_SPEED
  const z = Number.isFinite(fromZ) ? fromZ : segmentStartZ(segmentIndex) + 18
  const here = planSegment(z, segmentIndex, speed)
  if (here.length > 0) return here
  return planSegment(z, segmentIndex + 1, speed)
}

export function tourTotalMs(legs: readonly TourLeg[]): number {
  return legs.reduce((sum, leg) => sum + leg.travelMs + leg.dwellMs, 0)
}
