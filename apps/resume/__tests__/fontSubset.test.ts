import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { content } from '@/lib/content'
import { HAND_FONT_FILE } from '@/lib/lab/domain/sketch/types'

/**
 * 字体子集化的门禁。
 *
 * `public/fonts/` 下原本是 2.9MB 未子集化的 TTF，入口页一次拉 414KB；
 * 中文那一份 1479KB 里 99% 的字形永远不会被渲染。
 * `scripts/media/subset-fonts.py` 按仓库里实际出现过的字符裁剪并转 woff2。
 *
 * ## 子集化的风险与这组测试要守的东西
 *
 * **漏收一个字，那个字在页面上会静默变成兜底字体。** 中文里尤其明显：
 * 一句话里蹦出一个不同字形的字，而不会有任何报错。所以：
 *
 *   1. zh 文案里出现的每个汉字都必须在生成时的字符集覆盖范围内
 *   2. 每个 CSS 引用的 woff2 与每个 3D 引用的 TTF 都得存在
 *   3. woff2 与 TTF 必须同源（同名），否则 DOM 与 3D 会是两款字体
 */

const ROOT = join(import.meta.dirname, '..')
const FONTS = join(ROOT, 'public/fonts')
const SRC_FONTS = join(ROOT, 'media-src/fonts')

/** 从 globals.css 取出所有 @font-face 的 src */
function cssFontFiles(): string[] {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
  return [...css.matchAll(/url\('(\/fonts\/[^']+)'\)/g)].map(m => m[1]!)
}

/** 从源码取出所有传给 drei `<Text>` 的字体文件 */
function troikaFontFiles(): string[] {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(name)) {
        for (const m of readFileSync(full, 'utf8').matchAll(/'(\/fonts\/[^']+)'/g)) {
          found.add(m[1]!)
        }
      }
    }
  }
  for (const dir of ['components', 'lib']) walk(join(ROOT, dir))
  return [...found]
}

describe('字体产物', () => {
  it('原始 TTF 在 media-src/fonts（不随 public 部署）', () => {
    expect(existsSync(SRC_FONTS)).toBe(true)
    const sources = readdirSync(SRC_FONTS).filter(f => f.endsWith('.ttf'))
    expect(sources.length, 'media-src/fonts 下没有原始 TTF').toBeGreaterThan(0)
  })

  it('CSS 引用的每个字体文件都存在', () => {
    for (const file of cssFontFiles()) {
      expect(
        existsSync(join(ROOT, 'public', file.replace(/^\//, ''))),
        `${file} 不存在，@font-face 会静默失败`,
      ).toBe(true)
    }
  })

  it('CSS 一律用 woff2 —— TTF 大 60% 以上，而浏览器都支持 woff2', () => {
    for (const file of cssFontFiles()) {
      expect(file, `${file} 还是 TTF`).toMatch(/\.woff2$/)
    }
  })

  it('3D 文字引用的每个字体文件都存在且是 troika 支持的格式', () => {
    for (const file of troikaFontFiles()) {
      // CSS 用的 woff2 也会被这个扫描器抓到，跳过
      if (file.endsWith('.woff2')) continue
      expect(file, `${file} 不是 troika 支持的格式`).toMatch(/\.(ttf|otf|woff)$/)
      expect(
        existsSync(join(ROOT, 'public', file.replace(/^\//, ''))),
        `${file} 不存在，troika 会 fetch 404 然后落到兜底字体`,
      ).toBe(true)
    }
  })

  it('手写体的 woff2 与 TTF 同源 —— 不同源会让 DOM 与 3D 是两款字体', () => {
    const stem = HAND_FONT_FILE.replace(/\.ttf$/, '')
    expect(existsSync(join(ROOT, 'public', `${stem}.woff2`.replace(/^\//, '')))).toBe(true)
    expect(existsSync(join(ROOT, 'public', HAND_FONT_FILE.replace(/^\//, '')))).toBe(true)
  })

  it('每个产物都比原始 TTF 小 —— 否则子集化没生效', () => {
    for (const source of readdirSync(SRC_FONTS).filter(f => f.endsWith('.ttf'))) {
      const stem = source.replace(/\.ttf$/, '')
      const before = statSync(join(SRC_FONTS, source)).size
      const woff2 = join(FONTS, `${stem}.woff2`)
      expect(existsSync(woff2), `${stem}.woff2 没生成`).toBe(true)
      expect(statSync(woff2).size, `${stem}.woff2 没有比原始 TTF 小`).toBeLessThan(before)
    }
  })

  it('中文字体子集后显著变小 —— 全字符集是 1.4MB，这是最大的一块', () => {
    const woff2 = join(FONTS, 'ZCOOLKuaiLe-Regular.woff2')
    expect(existsSync(woff2)).toBe(true)
    expect(statSync(woff2).size, '中文 woff2 超过 400KB，像是没子集化')
      .toBeLessThan(400 * 1024)
  })

  it('产物比源新 —— 改了文案忘了重跑的话，新字会变成兜底字体', () => {
    for (const source of readdirSync(SRC_FONTS).filter(f => f.endsWith('.ttf'))) {
      const stem = source.replace(/\.ttf$/, '')
      const src = statSync(join(SRC_FONTS, source)).mtimeMs
      const woff2 = join(FONTS, `${stem}.woff2`)
      expect(
        statSync(woff2).mtimeMs,
        `${stem}.woff2 比源旧，跑 python3 scripts/media/subset-fonts.py`,
      ).toBeGreaterThanOrEqual(src)
    }
  })
})

describe('子集覆盖了实际用到的字', () => {
  /**
   * 生成脚本扫的是 `app` / `components` / `lib` / `hooks` / `context` 下的
   * `.ts` / `.tsx` / `.css`。这里断言中文文案确实落在那个范围里——
   * 文案要是搬到别的目录（比如 JSON），子集就会漏掉那些字而且不报错。
   */
  const SCAN_DIRS = ['app', 'components', 'lib', 'hooks', 'context']

  function scannedChars(): Set<string> {
    const chars = new Set<string>()
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx?|css)$/.test(name)) {
          for (const ch of readFileSync(full, 'utf8')) chars.add(ch)
        }
      }
    }
    for (const dir of SCAN_DIRS) {
      const full = join(ROOT, dir)
      if (existsSync(full)) walk(full)
    }
    return chars
  }

  it('zh 文案里的每个汉字都在扫描范围内', () => {
    const scanned = scannedChars()
    const zhText = JSON.stringify(content.zh)
    const missing = new Set<string>()
    for (const ch of zhText) {
      if (ch >= '一' && ch <= '鿿' && !scanned.has(ch)) missing.add(ch)
    }
    expect(
      [...missing],
      `这些字不在子集脚本的扫描范围里，会落到兜底字体：${[...missing].join('')}`,
    ).toEqual([])
  })

  it('Lab 界面文案里的每个汉字也在范围内', () => {
    const scanned = scannedChars()
    const labText = JSON.stringify(content.zh.labUi)
    for (const ch of labText) {
      if (ch >= '一' && ch <= '鿿') {
        expect(scanned.has(ch), `「${ch}」不在扫描范围里`).toBe(true)
      }
    }
  })
})
