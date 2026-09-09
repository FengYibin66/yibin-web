/**
 * 撕纸边缘的多边形顶点，唯一来源（`LabLoader` 与 `PaperTransition` 必须给出
 * 同一条撕痕）。
 *
 * 坐标**必须量化**（审计 G4）：ECMAScript 不规定 `Math.sin` 的精度，
 * Node 与浏览器的 V8 版本不同时末位会不一样，而 `LabLoader` 会被 SSR
 * ——全精度字符串会让每次进 /lab 都报一条 hydration 错误。
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
