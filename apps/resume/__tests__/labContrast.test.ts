import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  WCAG_AA,
  composite,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from '@/lib/a11y/contrast'
import { CORRIDOR_PAPER, OVERLAY_COLORS } from '@/lib/lab/domain/overlayColors'

/**
 * Lab 覆盖层文案的对比度（审计 E10）。
 *
 * 「几乎看不见」是主观描述，改的时候容易调成"我这块屏上够了"。这一组把它
 * 变成会红的断言：以走廊纸白为背景，逐个算 WCAG 对比度。
 */

describe('contrastRatio', () => {
  it('黑白是 21，同色是 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 6)
  })

  it('对称：换个顺序结果一样（不透明前景）', () => {
    expect(contrastRatio('#333333', '#eeeeee'))
      .toBeCloseTo(contrastRatio('#eeeeee', '#333333'), 6)
  })

  it('半透明前景先压到背景上 —— 不压的话 alpha 完全不起作用', () => {
    const opaque = contrastRatio('rgba(42,31,14,1)', CORRIDOR_PAPER)
    const faint = contrastRatio('rgba(42,31,14,0.2)', CORRIDOR_PAPER)
    expect(faint).toBeLessThan(opaque)
    expect(faint).toBeLessThan(2)
  })

  it('认得 #rgb / #rrggbb / rgb() / rgba()', () => {
    expect(parseColor('#fff')!.rgb).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseColor('#2a1f0e')!.rgb).toEqual({ r: 42, g: 31, b: 14 })
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ rgb: { r: 1, g: 2, b: 3 }, alpha: 1 })
    expect(parseColor('rgba(1,2,3,0.5)')!.alpha).toBe(0.5)
  })

  it('认不出的颜色返回 NaN 而不是假装算出一个值', () => {
    expect(Number.isNaN(contrastRatio('var(--x)', '#fff'))).toBe(true)
    expect(parseColor('chartreuse')).toBeNull()
  })

  it('alpha 为 0 时前景等于背景，对比度 1', () => {
    expect(contrastRatio('rgba(0,0,0,0)', '#ffffff')).toBeCloseTo(1, 6)
  })

  it('composite 与 relativeLuminance 自洽', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    expect(composite(black, 0, white)).toEqual(white)
    expect(composite(black, 1, white)).toEqual(black)
    expect(relativeLuminance(white)).toBeCloseTo(1, 6)
    expect(relativeLuminance(black)).toBeCloseTo(0, 6)
  })
})

describe('Lab 覆盖层文案在走廊纸白上可读', () => {
  it('操作提示过 AA 正文门槛（它是 10px 小字）', () => {
    const ratio = contrastRatio(OVERLAY_COLORS.hint, CORRIDOR_PAPER)
    expect(ratio, `对比度只有 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA.normalText)
  })

  it('"退出 Lab" 过 AA 正文门槛（12px）', () => {
    const ratio = contrastRatio(OVERLAY_COLORS.exitLab, CORRIDOR_PAPER)
    expect(ratio, `对比度只有 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA.normalText)
  })

  it('原先那两个值确实不达标 —— 记录问题的量级，防止改回去', () => {
    expect(contrastRatio('rgba(42,31,14,0.4)', CORRIDOR_PAPER)).toBeLessThan(3)
    expect(contrastRatio('rgba(200,169,110,0.6)', CORRIDOR_PAPER)).toBeLessThan(3)
  })
})

// ─── 门禁：Lab 组件里不再内联写低对比的文字颜色 ──────────────────────────────

const ROOT = join(import.meta.dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

describe('Lab 组件不内联写低对比文字色', () => {
  it('没有 alpha 低到读不出的 color', () => {
    const offenders: string[] = []
    for (const dir of ['components/lab', 'components/ui']) {
      for (const file of walk(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8')
        for (const [i, line] of source.split('\n').entries()) {
          // 只看 color: 的值；背景与边框另有标准（3:1）
          for (const m of line.matchAll(/\bcolor:\s*'(rgba?\([^')]*\))'/g)) {
            const ratio = contrastRatio(m[1]!, CORRIDOR_PAPER)
            if (Number.isNaN(ratio)) continue
            if (ratio >= WCAG_AA.largeText) continue
            offenders.push(
              `${relative(ROOT, file)}:${i + 1}  ${m[1]}  对比度 ${ratio.toFixed(2)}`,
            )
          }
        }
      }
    }
    expect(
      offenders,
      '这些文字色在走廊纸白上对比度低于 3（审计 E10）。放进 ' +
      'lib/lab/domain/overlayColors 并让本文件的断言覆盖它：\n' + offenders.join('\n'),
    ).toEqual([])
  })
})
