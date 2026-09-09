/**
 * Classic 项目卡的滚动倾斜（`[data-skew]`）：倾斜角是 Lenis 当前状态的**纯函数**，
 * 每帧派生（ADR 20260907120701）。
 *
 * 不能事件驱动：值只在事件发生时更新，停下就冻住。前身在 Lenis `scroll` 事件里
 * `gsap.to(skewY: velocity * 0.35)`，一次 8500px 的 hash 跳转把卡片推到 skewY ≈ 88°，
 * 之后再没有事件把它拉回。所以这里三条都要：每帧读、只在用户平滑滚动时施加、夹上限。
 *
 * 施加在 `SmoothScrollProvider`；E2E 断言所有卡片停下后 transform 恒等。
 */

/** Lenis 的 `isScrolling`：false 停下 / 'native' 原生（含程序化与锚点）/ 'smooth' 用户平滑滚动 */
export type LenisScrolling = boolean | 'native' | 'smooth'

/** 度 / (px/ms) */
export const SKEW_GAIN = 0.35
/** 上限。8° 已明显有「被风吹」的感觉，再大就像坏了 */
export const SKEW_MAX_DEG = 8

export function skewForScroll(velocity: number, isScrolling: LenisScrolling): number {
  if (isScrolling !== 'smooth') return 0
  if (!Number.isFinite(velocity) || velocity === 0) return 0
  const deg = velocity * SKEW_GAIN
  return Math.max(-SKEW_MAX_DEG, Math.min(SKEW_MAX_DEG, deg))
}
