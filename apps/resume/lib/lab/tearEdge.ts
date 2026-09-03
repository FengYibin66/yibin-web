/**
 * 撕纸边缘的多边形顶点 —— 唯一来源。
 *
 * 两个问题一起修：
 *
 * **1. hydration 不匹配（审计 G4）。** `LabLoader` 会被 SSR，它的 clip-path 是
 * 由 `Math.sin` 算出的坐标**全精度**拼成的字符串（`49.357092280789885%`）。
 * ECMAScript **不规定 `Math.sin` 的精度**，Node 与浏览器的 V8 版本不同时末位
 * 可以不一样——于是服务端与客户端渲染出的 style 属性不同，React 19 每次进
 * /lab 报一条 hydration 错误（dev 下红色 Issue 角标）。四舍五入到 3 位小数后
 * 两侧必然一致，而 0.001% 的视觉差异不存在。
 *
 * **2. 算法重复。** 同一段 sin 叠加原先在 `LabLoader` 与 `PaperTransition` 里
 * 各写一份。两处必须给出**同一条撕痕**——loader 退场与传送合纸用的是同一张
 * 纸的视觉延续，任一处改了参数另一处不跟就会露馅。
 */

/** 保留小数位。3 位足够：视口宽 4000px 时 0.001% = 0.04px。 */
export const TEAR_PRECISION = 3

export type TearPoint = readonly [number, number]

function quantize(value: number): number {
  return Number(value.toFixed(TEAR_PRECISION))
}

/**
 * 从上到下的撕痕顶点，坐标是百分比（0–100）。
 * 首尾锚在 50% 保证两半能拼合。
 */
export function buildTearPoints(segments = 12): TearPoint[] {
  const points: TearPoint[] = [[50, 0]]
  for (let i = 1; i < segments; i++) {
    const y = quantize((i / segments) * 100)
    // 两层 sin 叠加，模拟手撕纸的不规则边缘
    const x = quantize(50 + Math.sin(i * 2.3 + 1.1) * 3.2 + Math.sin(i * 5.7 + 0.7) * 1.5)
    points.push([x, y])
  }
  points.push([50, 100])
  return points
}

/** SVG path：画在两半之上的那条可见撕痕线 */
export function tearSvgPath(points: readonly TearPoint[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}

/** `x% y%` 序列，供 clip-path polygon 使用 */
export function tearEdgeCoords(points: readonly TearPoint[]): string {
  return points.map(([x, y]) => `${x}% ${y}%`).join(', ')
}
