import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { HAND_FONT, HAND_FONT_FILE } from '@/lib/lab/domain/sketch/types'

/**
 * 3D 文字的字体门禁。
 *
 * ## 为什么需要
 *
 * drei 的 `<Text>`（底层 troika-three-text）要**字体文件 URL**，不吃 CSS
 * 族名；而且它**不支持 woff2**——只认 ttf / otf / woff。这两条合起来是一个
 * 很好的静默失败源：
 *
 *   - 传 CSS 族名 → troika 当 URL 去 fetch → 404 → 落到内置兜底字体
 *   - 传 woff2 → 报 `woff2 fonts not supported` → 同样落到兜底
 *
 * 两种情况页面都照常渲染，只是字体不对。实机复验时确实撞上了第二种
 * （Projects 房间的显示器标题）。
 *
 * ## 顺带守住"3D 与 DOM 用同一款字体"
 *
 * `HAND_FONT`（CSS 族名）与 `HAND_FONT_FILE`（文件路径）必须指向同一款字体，
 * 否则便签上的手写字（canvas，走 CSS 族名）和显示器标题（3D，走文件）会是
 * 两款。
 */

const ROOT = join(import.meta.dirname, '..')
const PUBLIC = join(ROOT, 'public')

/** troika 支持的格式 */
const TROIKA_FORMATS = ['.ttf', '.otf', '.woff']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'out') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/** 源码里所有 `font=` / `font:` 传给 drei Text 的字符串字面量与常量名 */
function collectFontProps(): { file: string; value: string }[] {
  const found: { file: string; value: string }[] = []
  for (const dir of ['components', 'lib', 'app']) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const file of walk(base)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\bfont=\{?["']([^"'}]+)["']\}?/g)) {
        found.push({ file: relative(ROOT, file), value: match[1]! })
      }
    }
  }
  return found
}

describe('手写字体', () => {
  it('HAND_FONT_FILE 用的是 troika 支持的格式 —— woff2 会静默落到兜底字体', () => {
    expect(
      TROIKA_FORMATS.some(ext => HAND_FONT_FILE.endsWith(ext)),
      `${HAND_FONT_FILE} 不是 troika 支持的格式（${TROIKA_FORMATS.join(' / ')}）`,
    ).toBe(true)
  })

  it('字体文件真实存在于 public/ —— 不存在时 troika 静默 fetch 404', () => {
    const path = join(PUBLIC, HAND_FONT_FILE.replace(/^\//, ''))
    expect(existsSync(path), `${HAND_FONT_FILE} 不在 public/ 下`).toBe(true)
  })

  it('globals.css 的 @font-face 指向同一个文件 —— 不然 3D 与 DOM 是两款字体', () => {
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
    expect(css).toContain(HAND_FONT_FILE)
  })

  it('CSS 族名与文件在同一款字体上对得起来', () => {
    // HAND_FONT 的首选族名应当出现在 @font-face 声明里
    const primary = HAND_FONT.split(',')[0]!.replace(/['"]/g, '').trim()
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
    const block = css.slice(0, css.indexOf('@theme'))
    expect(block, `${primary} 没有 @font-face 声明`).toContain(primary)
  })

  it('没有源码把 woff2 或 CSS 族名传给 drei 的 Text', () => {
    const offenders = collectFontProps().filter(({ value }) => {
      if (value.endsWith('.woff2')) return true
      // 不以 / 或 http 开头 = 不是文件路径，大概是族名
      return !value.startsWith('/') && !value.startsWith('http')
    })
    expect(
      offenders,
      '这些 font= 的值不是 troika 能用的文件路径：\n' +
      offenders.map(o => `  ${o.file}: ${o.value}`).join('\n'),
    ).toEqual([])
  })

  it('public/fonts 下没有孤立的 woff2 版本 —— 两份都会被拉，白费流量', () => {
    const fonts = readdirSync(join(PUBLIC, 'fonts'))
    const stem = HAND_FONT_FILE.split('/').pop()!.replace(/\.[^.]+$/, '')
    expect(fonts.filter(f => f.startsWith(stem) && f.endsWith('.woff2'))).toEqual([])
  })

  it('许可文本随字体入库（OFL 要求保留）', () => {
    const fonts = readdirSync(join(PUBLIC, 'fonts'))
    expect(fonts.some(f => /PatrickHand.*OFL/i.test(f))).toBe(true)
  })

  it('字体是子集而不是全字符集 —— 全集 214KB，latin 子集 57KB', () => {
    const size = statSync(join(PUBLIC, HAND_FONT_FILE.replace(/^\//, ''))).size
    expect(size, `${Math.round(size / 1024)}KB，像是全字符集`).toBeLessThan(100 * 1024)
  })
})
