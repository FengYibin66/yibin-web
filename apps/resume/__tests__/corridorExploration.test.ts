import { describe, expect, it } from 'vitest'

import {
  EXPLORE_MIN_DISTANCE,
  hasExploredCorridor,
} from '@/lib/lab/domain/corridor/exploration'

/**
 * 「用户开始探索走廊了吗」的判定（ADR 20260903211302）。
 *
 * ## 这条判据换掉了什么
 *
 * 原实现是 `window.addEventListener('wheel' | 'touchmove', …, { once: true })`，
 * 于是**键盘用户永远拿不到 `corridor_explore`**——走廊的键盘前进
 * （↑↓ / PgUp / PgDn / 空格）走的是 `useCorridorCamera` 的 `keydown` 分支，
 * 既不产生 wheel 也不产生 touchmove。
 *
 * 后果不止是少一个成就：那条教程气泡（`Scroll or swipe to explore`）**只有被解锁
 * 才会关掉**（教程气泡刻意不自动消失），所以键盘用户从进 Lab 起就有一条永远关不掉
 * 的白底气泡压在屏幕底部——而它正好盖住底部的操作提示，也就是审计 E10 花力气把
 * 对比度从 2.4 提到 4.5 的那一条。
 *
 * 判据改成**位移**之后，滚轮 / 触摸 / 键盘走同一条路径，将来加新的输入方式也不
 * 需要记得补一次解锁。
 */

describe('hasExploredCorridor', () => {
  it('没动就不算', () => {
    expect(hasExploredCorridor(28, 28)).toBe(false)
  })

  it('动到阈值就算', () => {
    expect(hasExploredCorridor(28, 28 - EXPLORE_MIN_DISTANCE)).toBe(true)
  })

  it('差一点点不算', () => {
    expect(hasExploredCorridor(28, 28 - EXPLORE_MIN_DISTANCE + 0.01)).toBe(false)
  })

  it('两个方向都算 —— 走廊可以往回走', () => {
    expect(hasExploredCorridor(28, 28 - 5)).toBe(true)
    expect(hasExploredCorridor(28, 28 + 5)).toBe(true)
  })

  it('起点不写死 28 —— 从任意位置进走廊都按相对位移判', () => {
    /*
      传送会把相机放到某个门前，此时起点不是 28。判据用「相对起点的位移」而不是
      「绝对 z 超过某个值」，否则传送落地那一刻就会被判成"已探索"。
    */
    expect(hasExploredCorridor(-40, -40)).toBe(false)
    expect(hasExploredCorridor(-40, -43)).toBe(true)
  })

  it('阈值不小到会被阻尼的尾巴触发', () => {
    /*
      `currentZ` 是每帧向 `targetZ` 插值的（lerp 0.035），阻尼的尾巴会让它在目标
      附近持续微动。阈值太小（比如 0.1）等于"一进走廊就解锁"，那条教程气泡也就
      一闪而过——用户根本没机会读它。
    */
    expect(EXPLORE_MIN_DISTANCE).toBeGreaterThanOrEqual(1)
  })

  it('阈值不大到一次滚轮达不到', () => {
    /*
      一次滚轮 deltaY ≈ 100，`scrollSpeed` 0.02 → 目标位移 2 个单位。阈值超过它
      就要滚两下才解锁，而"滚一下"正是那条教程要求用户做的事。
    */
    expect(EXPLORE_MIN_DISTANCE).toBeLessThanOrEqual(2)
  })
})
