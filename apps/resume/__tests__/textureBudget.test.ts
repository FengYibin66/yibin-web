import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 入口页的纹理预算。
 *
 * 入口页原本一次拉 1626 KB 图片，最大的一张 `wall_bricks_2.webp` 是
 * 2048×1024 / **604 KB**——它是背景砖墙，桌面显示宽约 720px。
 * `scripts/media/optimize-textures.mjs` 按"显示尺寸 × 2"重编码。
 *
 * ## 为什么要有预算断言
 *
 * 素材是一张一张加进来的，每次都"只多一张"。没有上限的话，一年后又是
 * 1.6MB，而且没有任何一次改动看起来有问题。所以给单张与总量各设一条线。
 *
 * 线的位置基于当前实测（519 KB / 最大 87 KB）留出余量，不是拍脑袋——
 * 要突破就得先解释为什么。
 */

const ROOT = join(import.meta.dirname, '..')
const ENTRANCE = join(ROOT, 'public/textures/entrance')
const SRC_ENTRANCE = join(ROOT, 'media-src/textures/entrance')

/** 入口页纹理总量的上限。当前 519 KB */
const TOTAL_BUDGET_KB = 700
/** 单张的上限。当前最大 87 KB（砖墙），例外见下 */
const PER_FILE_BUDGET_KB = 120
/**
 * 单张超限的豁免。
 *
 * `speech_bubble` 里有文字，降尺寸会看不清；`stone-path` 是竖长图，
 * `fit: inside` 会把它压得比需要的更小。两者在生成脚本里都标了 `skip`。
 */
const PER_FILE_EXEMPT = new Set(['speech_bubble.webp', 'stone-path.webp'])

function sizeKb(path: string): number {
  return statSync(path).size / 1024
}

describe('入口页纹理', () => {
  it('原图在 media-src/textures（不随 public 部署）', () => {
    expect(existsSync(SRC_ENTRANCE), 'media-src/textures/entrance 不存在').toBe(true)
    expect(readdirSync(SRC_ENTRANCE).filter(f => f.endsWith('.webp')).length)
      .toBeGreaterThan(0)
  })

  it('每张原图都有对应的产物 —— 漏一张会让那个物件没有贴图', () => {
    for (const file of readdirSync(SRC_ENTRANCE).filter(f => f.endsWith('.webp'))) {
      expect(existsSync(join(ENTRANCE, file)), `${file} 没有产物`).toBe(true)
    }
  })

  it('产物比原图新 —— 换了素材忘了重跑的话，线上还是旧的大图', () => {
    for (const file of readdirSync(SRC_ENTRANCE).filter(f => f.endsWith('.webp'))) {
      expect(
        statSync(join(ENTRANCE, file)).mtimeMs,
        `${file} 的产物比原图旧，跑 node scripts/media/optimize-textures.mjs`,
      ).toBeGreaterThanOrEqual(statSync(join(SRC_ENTRANCE, file)).mtimeMs)
    }
  })

  it(`总量不超过 ${TOTAL_BUDGET_KB} KB`, () => {
    const files = readdirSync(ENTRANCE).filter(f => f.endsWith('.webp'))
    const total = files.reduce((sum, f) => sum + sizeKb(join(ENTRANCE, f)), 0)
    expect(
      total,
      `入口页纹理合计 ${total.toFixed(0)} KB，超了预算。` +
      `要么继续瘦身，要么先解释为什么值得抬这条线`,
    ).toBeLessThan(TOTAL_BUDGET_KB)
  })

  it(`单张不超过 ${PER_FILE_BUDGET_KB} KB（豁免的除外）`, () => {
    const offenders: string[] = []
    for (const file of readdirSync(ENTRANCE).filter(f => f.endsWith('.webp'))) {
      if (PER_FILE_EXEMPT.has(file)) continue
      const kb = sizeKb(join(ENTRANCE, file))
      if (kb > PER_FILE_BUDGET_KB) offenders.push(`${file} ${kb.toFixed(0)} KB`)
    }
    expect(offenders, `这些单张超限：\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('豁免名单里的每一项都真的存在 —— 僵尸豁免会掩盖新的超限', () => {
    for (const file of PER_FILE_EXEMPT) {
      expect(existsSync(join(ENTRANCE, file)), `${file} 已经不存在了，从豁免里删掉`)
        .toBe(true)
    }
  })

  it('产物都比原图小或相等 —— 反过来说明重编码起了反作用', () => {
    for (const file of readdirSync(SRC_ENTRANCE).filter(f => f.endsWith('.webp'))) {
      const src = sizeKb(join(SRC_ENTRANCE, file))
      const dst = sizeKb(join(ENTRANCE, file))
      expect(
        dst,
        `${file} 重编码后变大了（${src.toFixed(0)} → ${dst.toFixed(0)} KB）——` +
        `原图的编码参数已经更优，该在脚本里标 skip`,
      ).toBeLessThanOrEqual(src + 0.5)
    }
  })
})
