import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildTearPoints,
  tearEdgeCoords,
  tearSvgPath,
  TEAR_PRECISION,
} from '@/lib/lab/tearEdge'

/**
 * 撕纸边缘的回归测试。
 *
 * 核心断言是**坐标必须是有限位小数**（审计 G4）：`LabLoader` 会被 SSR，
 * 全精度的 `Math.sin` 结果拼进 clip-path 后，服务端（Node）与客户端（浏览器）
 * 可能给出末位不同的字符串——ECMAScript 不规定 `Math.sin` 的精度——于是每次
 * 进 /lab 都报一条 React hydration 错误。
 *
 * 变异测试：把 `quantize` 改成恒等函数，"没有超长小数"那条会红。
 */

const APP_ROOT = join(__dirname, '..')

describe('buildTearPoints', () => {
  const points = buildTearPoints()

  it('首尾锚在 50% —— 两半必须能拼合，否则接缝处露出底色', () => {
    expect(points[0]).toEqual([50, 0])
    expect(points.at(-1)).toEqual([50, 100])
  })

  it('y 单调递增且覆盖 0–100', () => {
    const ys = points.map(([, y]) => y)
    expect(ys[0]).toBe(0)
    expect(ys.at(-1)).toBe(100)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!, `第 ${i} 个点的 y 没有递增`).toBeGreaterThan(ys[i - 1]!)
    }
  })

  it('x 在纸面内且真的有抖动 —— 完全笔直就不像手撕的', () => {
    const xs = points.map(([x]) => x)
    for (const x of xs) {
      expect(x).toBeGreaterThan(40)
      expect(x).toBeLessThan(60)
    }
    expect(new Set(xs).size, 'x 全部相同 → 撕痕是直线').toBeGreaterThan(5)
  })

  it('没有超长小数 —— 这条就是 hydration 不匹配的防线（审计 G4）', () => {
    for (const [x, y] of points) {
      for (const [name, value] of [['x', x], ['y', y]] as const) {
        const decimals = String(value).split('.')[1]?.length ?? 0
        expect(
          decimals,
          `${name}=${value} 有 ${decimals} 位小数，超过 ${TEAR_PRECISION} 位`,
        ).toBeLessThanOrEqual(TEAR_PRECISION)
      }
    }
  })

  it('结果确定 —— 同一进程内两次调用完全一致', () => {
    expect(buildTearPoints()).toEqual(buildTearPoints())
  })

  it('段数可配，顶点数 = 段数 + 1', () => {
    expect(buildTearPoints(12)).toHaveLength(13)
    expect(buildTearPoints(4)).toHaveLength(5)
  })
})

describe('序列化', () => {
  const points = buildTearPoints()

  it('tearSvgPath 以 M 开头、其余为 L', () => {
    const path = tearSvgPath(points)
    expect(path.startsWith('M ')).toBe(true)
    expect(path.match(/M /g)).toHaveLength(1)
    expect(path.match(/L /g)).toHaveLength(points.length - 1)
  })

  it('tearEdgeCoords 每个顶点一对百分比', () => {
    const coords = tearEdgeCoords(points)
    expect(coords.split(', ')).toHaveLength(points.length)
    expect(coords).toMatch(/^50% 0%, /)
  })

  it('序列化结果里没有超长小数 —— 直接进 style 属性的就是它', () => {
    expect(tearEdgeCoords(points)).not.toMatch(/\.\d{4,}/)
    expect(tearSvgPath(points)).not.toMatch(/\.\d{4,}/)
  })
})

describe('两个消费方共用同一条撕痕（审计 G4 的另一半：算法重复）', () => {
  it('LabLoader 与 PaperTransition 都不再自己算 sin', () => {
    for (const rel of ['components/lab/LabLoader.tsx', 'components/lab/PaperTransition.tsx']) {
      const source = readFileSync(join(APP_ROOT, rel), 'utf8')
      expect(source, `${rel} 仍自己算撕痕`).not.toContain('Math.sin(i * 2.3')
      expect(source, `${rel} 没有引用共享模块`).toContain('buildTearPoints')
    }
  })
})
