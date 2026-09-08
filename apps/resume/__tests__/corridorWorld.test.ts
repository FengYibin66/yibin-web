import { describe, expect, it } from 'vitest'

import {
  EMPTY_WORLD,
  SPEED_RUN,
  SPEED_STILL,
  clampDelta,
  lapAt,
  motionOf,
  nearestDoorAhead,
  smoothVelocity,
  visitedNow,
} from '@/lib/lab/domain/corridor/world'
import {
  FIRST_SEGMENT_START_Z,
  SEGMENT_LENGTH,
  segmentStartZ,
} from '@/lib/lab/domain/corridor/layout'

/**
 * 走廊世界状态的纯派生（ADR 20260908172231）。
 *
 * 这里测的全是纯函数——**世界状态的价值就在于这些量只有一处算法**。
 * 反面教材是段号：`Math.floor((10 - z) / 100)` 曾在三处各写一份，其中一处是
 * 裸 `/ 100`，改段长时漏改的那处静默算错（审计 B3）。
 */
describe('走廊世界状态', () => {
  describe('lapAt（第几圈）', () => {
    it('相机初始位置（Z=28，段号 −1）算第 0 圈，不是负数', () => {
      // segmentIndexAtZ(28) = floor((10 − 28)/100) = −1
      expect(lapAt(28)).toBe(0)
    })

    it('第 0 段内是第 0 圈', () => {
      expect(lapAt(FIRST_SEGMENT_START_Z)).toBe(0)
      expect(lapAt(FIRST_SEGMENT_START_Z - 1)).toBe(0)
      expect(lapAt(FIRST_SEGMENT_START_Z - SEGMENT_LENGTH + 1)).toBe(0)
    })

    it('走过一整段进入第 1 圈', () => {
      expect(lapAt(segmentStartZ(1))).toBe(1)
      expect(lapAt(segmentStartZ(2))).toBe(2)
    })

    it('非有限输入退化为 0（NaN 不该变成 NaN 圈）', () => {
      expect(lapAt(Number.NaN)).toBe(0)
      expect(lapAt(Number.POSITIVE_INFINITY)).toBe(0)
    })
  })

  describe('smoothVelocity（速度，单位/秒，负数=前进）', () => {
    it('位移除以时间，前进为负', () => {
      // 一帧 (1/60)s 前进 0.5 单位 → −30 单位/秒；EMA 首帧从 0 起，故取部分值
      const v = smoothVelocity(0, -0.5, 1 / 60)
      expect(v).toBeLessThan(0)
      expect(v).toBeGreaterThan(-30)
    })

    it('连续同向位移收敛到真实速度', () => {
      let v = 0
      for (let i = 0; i < 200; i++) v = smoothVelocity(v, -0.5, 1 / 60)
      expect(v).toBeCloseTo(-30, 0)
    })

    it('停下后收敛回 0', () => {
      let v = -30
      for (let i = 0; i < 200; i++) v = smoothVelocity(v, 0, 1 / 60)
      expect(Math.abs(v)).toBeLessThan(SPEED_STILL)
    })

    it('dt 为 0 时不产生 Infinity（标签页切回、首帧）', () => {
      expect(smoothVelocity(-5, -1, 0)).toBe(-5)
    })

    /**
     * 语义是「坏输入不产生坏输出」，不是「坏输入返回 0」：
     * 上一帧的值坏了就当 0 重新起步、这一帧照常平滑（所以第一条不是 0）。
     *
     * 关键在于结果必须**有限**。`Infinity` 一旦进入这个 EMA 就再也出不去
     * （`Infinity * 0.8 + x * 0.2` 仍是 `Infinity`），一次坏值会冻住整个会话
     * ——`scrollSkew` 那次事故就是这个形态：skewY 被推到 88° 后再没有东西把它拉回。
     */
    it('坏输入不产生坏输出（NaN / Infinity 不进入后续帧）', () => {
      expect(smoothVelocity(Number.NaN, -1, 1 / 60)).toBe(-12)
      expect(smoothVelocity(0, Number.NaN, 1 / 60)).toBe(0)
      expect(smoothVelocity(Number.POSITIVE_INFINITY, -1, 1 / 60)).toBeCloseTo(-12)

      let v = 0
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        v = smoothVelocity(v, bad, 1 / 60)
        expect(Number.isFinite(v)).toBe(true)
      }
    })
  })

  describe('clampDelta（夹紧帧时长）', () => {
    it('正常帧原样通过', () => {
      expect(clampDelta(1 / 60)).toBeCloseTo(1 / 60)
    })

    it('标签页切回的巨大 delta 被夹到上限（否则活物一步跳半条走廊）', () => {
      expect(clampDelta(12)).toBe(0.05)
    })

    it('负数与 NaN 归零', () => {
      expect(clampDelta(-1)).toBe(0)
      expect(clampDelta(Number.NaN)).toBe(0)
    })
  })

  describe('motionOf（速度 → 运动档）', () => {
    it('静止 / 走 / 跑三档按阈值划分', () => {
      expect(motionOf(0)).toBe('still')
      expect(motionOf(-SPEED_STILL / 2)).toBe('still')
      expect(motionOf(-(SPEED_STILL + SPEED_RUN) / 2)).toBe('walk')
      expect(motionOf(-SPEED_RUN * 2)).toBe('run')
    })

    it('倒退与前进同档（方向不影响快慢）', () => {
      expect(motionOf(SPEED_RUN * 2)).toBe('run')
    })
  })

  describe('nearestDoorAhead（前方最近的门）', () => {
    it('从段起点往前看，第一扇是 About（relativeZ −8）', () => {
      const hit = nearestDoorAhead(segmentStartZ(0))
      expect(hit?.landmark.kind).toBe('door')
      expect(hit && 'roomId' in hit.landmark && hit.landmark.roomId).toBe('about')
    })

    it('走过 About 之后最近的是 Projects', () => {
      const hit = nearestDoorAhead(segmentStartZ(0) - 10)
      expect(hit && 'roomId' in hit.landmark && hit.landmark.roomId).toBe('projects')
    })

    it('距离是正数，且门在相机前方（世界 z 更小）', () => {
      const camZ = segmentStartZ(0) - 10
      const hit = nearestDoorAhead(camZ)
      expect(hit!.distance).toBeGreaterThan(0)
      expect(hit!.worldZ).toBeLessThan(camZ)
    })

    it('跨段：接近段末时看到的是下一段的第一扇门', () => {
      const nearEnd = segmentStartZ(0) - (SEGMENT_LENGTH - 2)
      const hit = nearestDoorAhead(nearEnd)
      expect(hit).not.toBeNull()
      expect(hit!.worldZ).toBeLessThan(nearEnd)
      expect(hit!.segmentIndex).toBe(1)
    })

    it('相机在起点之前（Z=28）也能找到第 0 段的门', () => {
      const hit = nearestDoorAhead(28)
      expect(hit && 'roomId' in hit.landmark && hit.landmark.roomId).toBe('about')
      expect(hit!.segmentIndex).toBe(0)
    })
  })

  describe('visitedNow（这一帧经过了哪些地标）', () => {
    it('相机在门口 → 该门在列表里', () => {
      const doorZ = segmentStartZ(0) - 8
      expect(visitedNow(doorZ)).toContain('door-about')
    })

    it('相机远离所有地标 → 空', () => {
      // 段起点 +5：欢迎区在 −2（半径未声明）、第一扇门在 −8（半径 8）
      expect(visitedNow(segmentStartZ(0) + 20)).toEqual([])
    })

    it('只算当前段与相邻段，不会把远处同名地标算进来', () => {
      const ids = visitedNow(segmentStartZ(0) - 8)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('没有 visitRadius 的地标永不出现（欢迎区、段末门）', () => {
      const all = new Set<string>()
      for (let z = segmentStartZ(0) + 30; z > segmentStartZ(1); z -= 1) {
        for (const id of visitedNow(z)) all.add(id)
      }
      expect(all.has('welcome-avatar')).toBe(false)
      expect(all.has('segment-door')).toBe(false)
      expect(all.has('door-about')).toBe(true)
    })
  })

  describe('EMPTY_WORLD', () => {
    it('是一个可直接使用的初始态：静止、第 0 圈、未加载、无记忆、动效开启', () => {
      expect(EMPTY_WORLD.rail.velocity).toBe(0)
      expect(EMPTY_WORLD.lap).toBe(0)
      expect(EMPTY_WORLD.loadProgress).toBe(0)
      expect(EMPTY_WORLD.visited.size).toBe(0)
      expect(EMPTY_WORLD.inked.size).toBe(0)
      expect(EMPTY_WORLD.motionScale).toBe(1)
      expect(EMPTY_WORLD.mode).toBe('free')
    })
  })
})
