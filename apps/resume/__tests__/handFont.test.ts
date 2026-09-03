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

/**
 * 去掉 JS/JSX 注释。
 *
 * **必须做。** 解释"为什么每个 `<Text>` 都要有 font"的注释里自然会出现
 * `<Text>` 字面量，扫描器把它当成一处真实用法。第一版就是这么误报的
 * ——而这类错误在本仓库已经踩过三次（Navbar 的颜色门禁、push-main 守卫的
 * 反引号、相机所有权门禁）。规则约束的是**代码**，不是说明文字。
 */
export function stripJsxComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const two = source.slice(i, i + 2)
    if (two === '//') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }
    if (two === '/*') {
      i += 2
      while (i < source.length && source.slice(i, i + 2) !== '*/') i += 1
      i += 2
      continue
    }
    out += source[i]
    i += 1
  }
  return out
}

/**
 * 取出一个 JSX 标签的完整文本。
 *
 * 不能用 `/<Text[^>]*>/`：属性里的箭头函数（`ref={(el) => {...}}`）含 `>`，
 * 正则会在那里提前截断，于是后面的 `font=` 被漏掉——第一版把两处**有** font
 * 的 `<Text>` 误报成缺失。这里跟踪花括号/圆括号深度，只在深度为 0 时认 `>`。
 */
export function tagTextAt(source: string, start: number): string {
  let depth = 0
  let i = start
  while (i < source.length) {
    const ch = source[i]!
    if (ch === '{' || ch === '(' || ch === '[') depth += 1
    else if (ch === '}' || ch === ')' || ch === ']') depth -= 1
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1)
    i += 1
  }
  return source.slice(start)
}

/** 源码里每一处 drei `<Text>` 的标签文本 */
function collectTextTags(): { file: string; tag: string; line: number }[] {
  const found: { file: string; tag: string; line: number }[] = []
  for (const dir of ['components', 'lib', 'app']) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const file of walk(base)) {
      const source = stripJsxComments(readFileSync(file, 'utf8'))
      // 只看真的从 drei 引入了 Text 的文件
      if (!/from '@react-three\/drei'/.test(source)) continue
      if (!/\bText\b/.test(source)) continue
      for (const match of source.matchAll(/<Text\b/g)) {
        const tag = tagTextAt(source, match.index!)
        found.push({
          file: relative(ROOT, file),
          tag,
          line: source.slice(0, match.index).split('\n').length,
        })
      }
    }
  }
  return found
}

/** 每处 `font=` 的值 */
function collectFontProps(): { file: string; value: string }[] {
  return collectTextTags().flatMap(({ file, tag }) => {
    const m = tag.match(/\bfont=\{?["']([^"'}]+)["']\}?/)
    return m ? [{ file, value: m[1]! }] : []
  })
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

  /*
    早先这里断言的是"CSS 与 3D 指向**同一个文件**"。前提已经变了：字体
    子集化之后**刻意发两份**——CSS 用 woff2（小 60%+），3D 用 TTF（troika
    不支持 woff2）。现在要守的是"同源"：两份必须来自同一款字体，
    即同名不同扩展名。
  */
  it('globals.css 用同一款字体的 woff2 —— 不同源会让 3D 与 DOM 是两款字体', () => {
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
    const woff2 = HAND_FONT_FILE.replace(/\.ttf$/, '.woff2')
    expect(css, `globals.css 里没有 ${woff2}`).toContain(woff2)
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

  /*
    这条原先禁止 woff2 与 TTF 并存（"两份都会被拉，白费流量"）。子集化之后
    并存是**必要的**：CSS 侧的 woff2 与 3D 侧的 TTF 各有其用，而且各自只在
    需要时被拉——CSS 的那份由 @font-face 触发，TTF 的那份只有渲染 3D 文字时
    troika 才去取。所以改成断言两份都在、且 woff2 明显更小。
  */
  it('woff2 与 TTF 并存，且 woff2 明显更小（子集化的意义）', () => {
    const stem = HAND_FONT_FILE.replace(/\.ttf$/, '')
    const ttf = join(PUBLIC, HAND_FONT_FILE.replace(/^\//, ''))
    const woff2 = join(PUBLIC, `${stem}.woff2`.replace(/^\//, ''))
    expect(existsSync(ttf), 'troika 用的 TTF 不在').toBe(true)
    expect(existsSync(woff2), 'CSS 用的 woff2 不在').toBe(true)
    expect(statSync(woff2).size, 'woff2 没有比 TTF 小').toBeLessThan(statSync(ttf).size)
  })

  it('每一处 drei <Text> 都传了 font —— 不传的话 troika 去 fonts.gstatic.com 拉，大陆访客加载失败', () => {
    const missing = collectTextTags().filter(({ tag }) => !/\bfont[=:]/.test(tag))
    expect(
      missing,
      '这些 <Text> 没有 font（审计 E8）：\n' +
      missing.map(m => `  ${m.file}:${m.line}`).join('\n'),
    ).toEqual([])
  })

  it('扫描器不误报（自检）', () => {
    // 注释里的 <Text> 不算
    expect(stripJsxComments('/* 见 <Text> 的说明 */ const a = 1')).not.toContain('Text')
    // 属性里的箭头函数不该让标签提前结束
    const tag = tagTextAt('<Text ref={(el) => { el.x > 1 }} font="/a.ttf">x</Text>', 0)
    expect(tag).toContain('font=')
    expect(tag.endsWith('>')).toBe(true)
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
