import { describe, expect, it } from 'vitest'

import { landmarkById } from '@/lib/lab/domain/corridor/landmarks'
import { FIRST_SEGMENT_START_Z, segmentStartZ } from '@/lib/lab/domain/corridor/layout'
import {
  TOUR_MAX_MS,
  TOUR_MAX_MS_REDUCED,
  TOUR_SPEED,
  TOUR_STOPS,
  tourPlan,
  tourStopZ,
  tourTotalMs,
} from '@/lib/lab/domain/corridor/tour'

/** 相机的起点（LabScene 的初始 z） */
const START_Z = 28

describe('招聘官路线（ADR 20260908204302）', () => {
  it('每个停靠点引用真实地标，id 唯一', () => {
    const ids = new Set<string>()
    for (const stop of TOUR_STOPS) {
      expect(landmarkById(stop.landmarkId), stop.id).toBeDefined()
      expect(ids.has(stop.id)).toBe(false)
      ids.add(stop.id)
    }
  })

  it('八站：头像、五扇门、时间线、段末门，按走廊顺序（没有猫：招聘官的 60 秒不该花在猫上）', () => {
    expect(TOUR_STOPS.map(s => s.id)).toEqual([
      'welcome', 'about', 'projects', 'publications', 'gallery', 'timeline', 'contact', 'end',
    ])
    const zs = TOUR_STOPS.map(s => tourStopZ(s, 0))
    for (let i = 1; i < zs.length; i += 1) expect(zs[i]!).toBeLessThan(zs[i - 1]!)
  })

  it('停靠点在地标前方 standOff 处（+z）', () => {
    const about = TOUR_STOPS.find(s => s.id === 'about')!
    expect(tourStopZ(about, 0)).toBe(FIRST_SEGMENT_START_Z + -8 + 4.5)
    expect(tourStopZ(about, 1)).toBe(segmentStartZ(1) + -8 + 4.5)
  })

  it('从起点出发的完整计划 ≤ 60 s；reduced ≤ 75 s', () => {
    const legs = tourPlan(START_Z, 0)
    expect(legs).toHaveLength(TOUR_STOPS.length)
    expect(tourTotalMs(legs)).toBeLessThanOrEqual(TOUR_MAX_MS)
    expect(tourTotalMs(tourPlan(START_Z, 0, true))).toBeLessThanOrEqual(TOUR_MAX_MS_REDUCED)
  })

  it('行进时间 = 距离 / 速度', () => {
    const [first] = tourPlan(START_Z, 0)
    expect(first!.travelMs).toBe(Math.round((Math.abs(START_Z - first!.targetZ) / TOUR_SPEED) * 1000))
  })

  it('从走廊中段开始：已经过了的停靠点跳过，不倒着走', () => {
    // 站在 −20：publications 的停靠点 −15 已在身后（目标 > 当前 − 0.5），从 gallery 起
    const legs = tourPlan(FIRST_SEGMENT_START_Z - 30, 0)
    expect(legs.map(l => l.stop.id)).toEqual(['gallery', 'timeline', 'contact', 'end'])
    for (const leg of legs) expect(leg.targetZ).toBeLessThan(FIRST_SEGMENT_START_Z - 30)
  })

  it('坏的起点按段起点 + 18（相机默认位置）算', () => {
    expect(tourPlan(Number.NaN, 0)).toEqual(tourPlan(segmentStartZ(0) + 18, 0))
  })

  it('站在段末门前再按一次：计划下一段（没有时间线站——年份刻度只在第 0 段），不是空计划', () => {
    // 段末门停靠点在 −77（10 − 95 + 8）；站到它后面（−80）再按
    const endZ = segmentStartZ(0) - 90
    const legs = tourPlan(endZ, 0)
    expect(legs.length).toBeGreaterThan(0)
    expect(legs.map(l => l.stop.id)).toEqual([
      'welcome', 'about', 'projects', 'publications', 'gallery', 'contact', 'end',
    ])
    for (const leg of legs) expect(leg.targetZ).toBeLessThan(endZ)
    expect(tourTotalMs(legs)).toBeLessThanOrEqual(TOUR_MAX_MS)
  })

  it('停留合计 30 s（规格 §5.1）', () => {
    expect(TOUR_STOPS.reduce((s, x) => s + x.dwellMs, 0)).toBe(30_000)
  })
})
