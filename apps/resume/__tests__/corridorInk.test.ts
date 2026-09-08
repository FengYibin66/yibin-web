import { describe, expect, it } from 'vitest'

import {
  INK_LOAD_OVERLAP,
  inkLevel,
  loadInkOrder,
  loadIntroInk,
  LAP_INK,
  introDrawLevel,
  INTRO_TEAR_AT,
  INTRO_DRAWN_AT,
  type InkInputs,
} from '@/lib/lab/domain/corridor/ink'
import { inkableLandmarkIds } from '@/lib/lab/domain/corridor/landmarks'

/**
 * 显形策略（ADR 20260908172231）。
 *
 * `RevealMaterial` 的 `uProgress`（0→1 把草稿擦成上色）此前只有一个用途：
 * 门 hover。它同时是「看过的永久上色」「第二圈全上色」「加载时把走廊画出来」
 * 三件事的机制，而 `uProgress` **只有一个** —— 三处各写就会互相覆盖，
 * 表现为闪烁，且没有任何测试守得住。
 *
 * ## 稳态与过场是两件事
 *
 * ADR 的索引原本把公式写成 `max(加载, 记忆, 圈数, 悬停)`。实现时发现那是错的：
 * 加载进度在加载完成后**恒为 1**，于是所有门会永久上色 ——「只有看过的才上色」
 * 直接失效。所以：
 *
 * - `inkLevel` = **稳态** = `max(记忆, 圈数, 悬停)`
 * - `loadIntroInk` = **过场**，由加载动画自己驱动，不进 `inkLevel`
 */

const base: InkInputs = {
  inked: new Set<string>(),
  lap: 0,
  hover: 0,
}

const someId = inkableLandmarkIds()[0]!

describe('显形策略', () => {
  describe('稳态：inkLevel', () => {
    it('全零输入 → 0（进走廊时门是草稿）', () => {
      expect(inkLevel(someId, base)).toBe(0)
    })

    it('记忆：已显形的地标恒为 1', () => {
      expect(inkLevel(someId, { ...base, inked: new Set([someId]) })).toBe(1)
    })

    it('圈数：第 2 圈（lap ≥ 1）起未访问的门有底色（LAP_INK），但不到 1 —— 记忆仍可辨', () => {
      expect(inkLevel('door-about', { inked: new Set(), lap: 1 })).toBe(LAP_INK)
      expect(inkLevel('door-about', { inked: new Set(), lap: 3 })).toBe(LAP_INK)
      expect(inkLevel('door-about', { inked: new Set(['door-about']), lap: 1 })).toBe(1)
      // 悬停仍能把它推满
      expect(inkLevel('door-about', { inked: new Set(), lap: 1, hover: 1 })).toBe(1)
      expect(LAP_INK).toBeGreaterThan(0.3)
      expect(LAP_INK).toBeLessThan(0.8)
    })

    it('悬停：直接透传，且被夹在 0–1', () => {
      expect(inkLevel(someId, { ...base, hover: 0.5 })).toBe(0.5)
      expect(inkLevel(someId, { ...base, hover: 3 })).toBe(1)
      expect(inkLevel(someId, { ...base, hover: -1 })).toBe(0)
    })

    it('取最大值：悬停 0.3 + 已记忆 → 1（悬停不会让已上色的门变淡）', () => {
      expect(inkLevel(someId, { ...base, hover: 0.3, inked: new Set([someId]) })).toBe(1)
    })

    /**
     * 这一条是上面那个公式错误的回归测试。
     *
     * 若把加载进度并进 `inkLevel`，加载完成（进度 1）之后未访问的门也会是 1，
     * 于是"走廊里哪些看过"这个信息永久丢失。
     */
    it('加载进度不参与稳态：未访问的门在加载完成后仍是草稿', () => {
      const untouched = inkableLandmarkIds().filter(id => id !== someId)
      for (const id of untouched) {
        expect(inkLevel(id, { ...base, inked: new Set([someId]) })).toBe(0)
      }
    })

    it('记忆置位后，其他来源怎么变都保持 1', () => {
      const inked = new Set([someId])
      for (const lap of [0, 1]) {
        for (const hover of [0, 1]) {
          expect(inkLevel(someId, { inked, lap, hover })).toBe(1)
        }
      }
    })

    it('结果永远落在 0–1（坏输入也一样）', () => {
      const bad: InkInputs[] = [
        { ...base, lap: Number.NaN },
        { ...base, hover: Number.NaN },
        { ...base, hover: Number.POSITIVE_INFINITY },
      ]
      for (const inputs of bad) {
        const value = inkLevel(someId, inputs)
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    })

    it('未知 id 不抛（记忆里可能存着已删除的地标）', () => {
      expect(() => inkLevel('no-such-landmark', base)).not.toThrow()
      expect(inkLevel('no-such-landmark', base)).toBe(0)
    })
  })

  describe('加载期时间窗：introDrawLevel（决定 D）', () => {
    it('30% 之前一笔没画，90% 之后画完，中间线性', () => {
      expect(introDrawLevel(0)).toBe(0)
      expect(introDrawLevel(INTRO_TEAR_AT)).toBe(0)
      expect(introDrawLevel(0.6)).toBeCloseTo(0.5, 6)
      expect(introDrawLevel(INTRO_DRAWN_AT)).toBe(1)
      expect(introDrawLevel(1)).toBe(1)
    })

    it('坏进度夹在 0–1', () => {
      for (const p of [Number.NaN, -1, 5]) {
        const v = introDrawLevel(p)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })

    it('与 loadIntroInk 串起来：30% 时所有门都还是空白，90% 时全画完', () => {
      for (const id of inkableLandmarkIds()) {
        expect(loadIntroInk(id, introDrawLevel(0.3))).toBe(0)
        expect(loadIntroInk(id, introDrawLevel(0.9))).toBe(1)
      }
    })
  })

  describe('过场：loadIntroInk（LabLoader 经 corridorStore.loadProgress 驱动 DoorSection 的 uDraw）', () => {
    it('loadInkOrder 覆盖全部可显形地标，序号从 0 起连续', () => {
      const ids = inkableLandmarkIds()
      const orders = ids.map(id => loadInkOrder(id))
      expect(new Set(orders).size).toBe(ids.length)
      expect(Math.min(...orders)).toBe(0)
      expect(Math.max(...orders)).toBe(ids.length - 1)
    })

    it('顺序按走廊深度：越靠近入口越早被画出来', () => {
      // door-about 在 −8，door-contact 在 −56
      expect(loadInkOrder('door-about')).toBeLessThan(loadInkOrder('door-contact'))
    })

    it('进度为 0 时全是草稿；进度为 1 时全部上色', () => {
      for (const id of inkableLandmarkIds()) {
        expect(loadIntroInk(id, 0)).toBe(0)
        expect(loadIntroInk(id, 1)).toBe(1)
      }
    })

    it('进度推进时，靠前的地标先完成', () => {
      expect(loadIntroInk('door-about', 0.5)).toBeGreaterThan(loadIntroInk('door-contact', 0.5))
    })

    it('相邻地标的显形窗口重叠（不是一个一个跳，而是连成一笔）', () => {
      expect(INK_LOAD_OVERLAP).toBeGreaterThan(0)
      const ids = inkableLandmarkIds()
      const partial = (p: number) =>
        ids.filter(id => {
          const v = loadIntroInk(id, p)
          return v > 0.01 && v < 0.99
        }).length
      const maxConcurrent = Math.max(...[0.2, 0.4, 0.5, 0.6, 0.8].map(partial))
      expect(maxConcurrent).toBeGreaterThanOrEqual(2)
    })

    it('单调不减（画着的东西不会倒退）', () => {
      for (const id of inkableLandmarkIds()) {
        let previous = -1
        for (let p = 0; p <= 1.0001; p += 0.02) {
          const value = loadIntroInk(id, Math.min(1, p))
          expect(value, `${id} 在进度 ${p.toFixed(2)} 处倒退`).toBeGreaterThanOrEqual(previous)
          previous = value
        }
      }
    })

    it('坏进度不产生坏结果', () => {
      for (const p of [Number.NaN, -3, 99, Number.POSITIVE_INFINITY]) {
        const value = loadIntroInk('door-about', p)
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    })

    it('未知 id 返回 0，不抛', () => {
      expect(loadIntroInk('no-such-landmark', 0.5)).toBe(0)
    })
  })
})
