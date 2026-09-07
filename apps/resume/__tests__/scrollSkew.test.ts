import { describe, expect, it } from 'vitest'

import { SKEW_GAIN, SKEW_MAX_DEG, skewForScroll } from '@/lib/animations/scrollSkew'

/**
 * 滚动倾斜（Classic 项目卡的 `[data-skew]`）的量怎么算（2026-09-07 实机 bug）。
 *
 * 前身在每次 Lenis `scroll` 事件里 `gsap.to('[data-skew]', { skewY: velocity * 0.35 })`。
 * 详情页 → 返回简历（hash 跳转 8500px 一步到位）那一帧 dev 上算出的速度极大，
 * 16 张项目卡被推到 skewY ≈ 88°，之后**没有任何机制拉回**——不再有 scroll 事件，
 * 再滚也不恢复。我此前的测试只量 opacity，没量 transform，所以全绿。
 *
 * 新模型：倾斜量是 Lenis 当前状态的**纯函数**，每帧派生、不靶向事件：
 *   - 只在用户平滑滚动（`isScrolling === 'smooth'`）时施加；程序化 / 锚点跳转是 `'native'`，
 *     停下是 `false`，两者都是 0 —— Lenis 一停，倾斜自然归零
 *   - 夹在 ±SKEW_MAX_DEG，任何速度都不可能把卡片扭成一条线
 */
describe('skewForScroll', () => {
  it('不在平滑滚动中 → 0（停下、原生跳转都算）', () => {
    expect(skewForScroll(250, false)).toBe(0)
    expect(skewForScroll(250, 'native')).toBe(0)
    expect(skewForScroll(-40, false)).toBe(0)
  })

  it('平滑滚动中按增益线性，保留方向', () => {
    expect(skewForScroll(10, 'smooth')).toBeCloseTo(10 * SKEW_GAIN)
    expect(skewForScroll(-10, 'smooth')).toBeCloseTo(-10 * SKEW_GAIN)
  })

  it('夹在 ±SKEW_MAX_DEG —— hash 跳转那种速度不会扭出 88°', () => {
    expect(skewForScroll(250, 'smooth')).toBe(SKEW_MAX_DEG)
    expect(skewForScroll(-250, 'smooth')).toBe(-SKEW_MAX_DEG)
    expect(SKEW_MAX_DEG).toBeLessThanOrEqual(10)
  })

  it('速度 0 → 0；NaN 视为 0（Lenis 初始化那一帧可能没有速度）', () => {
    expect(skewForScroll(0, 'smooth')).toBe(0)
    expect(skewForScroll(Number.NaN, 'smooth')).toBe(0)
  })
})
