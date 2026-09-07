/**
 * Classic 项目卡的滚动倾斜（`[data-skew]`）：倾斜角是 Lenis 当前状态的**纯函数**。
 *
 * ## 前身怎么坏的（2026-09-07）
 *
 * `SmoothScrollProvider` 在每次 Lenis `scroll` 事件里
 * `gsap.to('[data-skew]', { skewY: velocity * 0.35, duration: 0.6 })`。
 * 详情页 → 返回简历是一次 8500px 一步到位的 hash 跳转，dev 上那一帧算出的速度极大，
 * 16 张项目卡被推到 skewY ≈ 88°（`matrix(1, 35.26, 0, 1)`）——之后 Lenis 不再发事件，
 * **没有任何东西把它拉回**，再滚动也不恢复。生产因为快而"碰巧"没撞上。
 *
 * 事件驱动的写法有两个结构性问题：值只在事件发生时更新（停下就冻住），且对
 * 速度不设上限。所以换成：
 *
 *   - **每帧派生**（在 gsap ticker 里读 `lenis.velocity`），Lenis 一停速度归零、倾斜归零
 *   - **只在用户平滑滚动时施加**（`isScrolling === 'smooth'`）；程序化 / 锚点跳转是
 *     `'native'`、停下是 `false`，都不倾斜
 *   - **夹在 ±SKEW_MAX_DEG**
 *
 * 纯函数在这里，施加在 `SmoothScrollProvider`；E2E 断言所有卡片停下后 transform 恒等。
 */

/** Lenis 的 `isScrolling`：false 停下 / 'native' 原生（含程序化与锚点）/ 'smooth' 用户平滑滚动 */
export type LenisScrolling = boolean | 'native' | 'smooth'

/** 度 / (px/ms)。0.35 沿用前身的手感 */
export const SKEW_GAIN = 0.35
/** 上限。8° 已经明显有"被风吹"的感觉，再大就开始像坏了 */
export const SKEW_MAX_DEG = 8

export function skewForScroll(velocity: number, isScrolling: LenisScrolling): number {
  if (isScrolling !== 'smooth') return 0
  if (!Number.isFinite(velocity) || velocity === 0) return 0
  const deg = velocity * SKEW_GAIN
  return Math.max(-SKEW_MAX_DEG, Math.min(SKEW_MAX_DEG, deg))
}
