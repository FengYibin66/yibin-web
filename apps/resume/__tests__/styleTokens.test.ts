import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 字体族名与主题 token 的机制门禁。
 *
 * 加它的直接原因（审计 E1）：`globals.css` 的 `@font-face` 声明的族名是
 * `'CabinSketch'`（按 font-weight 区分粗细），而 8 个文件里 16 处写的是
 * `'CabinSketch-Bold'` 与 `'Patrick Hand'`——**两个族名都不存在**，于是
 * Lab 的全部 DOM 覆盖层（导航面板、成就面板、教程、loader、Gallery 返回
 * 按钮、ExplorerBar）字体一律落到兜底，macOS 上表现为 `cursive` 花体。
 *
 * 这类 bug 不会报错、不会警告，只会让界面看起来"就是这个样子"。唯一能
 * 抓住它的办法是把「引用的族名必须真实存在」变成断言。
 *
 * 3D 的 `<Text>` 不受影响——troika 直接读 TTF 文件路径，不走 CSS 族名。
 */

const APP_ROOT = join(__dirname, '..')

/** 系统/通用族名：不需要 @font-face 声明也能解析 */
const SYSTEM_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-monospace', 'ui-sans-serif', 'ui-serif',
  'georgia', 'menlo', 'monaco', 'consolas', 'courier new', 'courier',
  'helvetica', 'helvetica neue', 'arial', 'times new roman', 'times',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto',
])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next' || entry === 'out') return []
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** 从 globals.css 动态读出真实声明过的族名——测试不硬编码，跟着实现走 */
function declaredFontFaceFamilies(): Set<string> {
  const css = readFileSync(join(APP_ROOT, 'app/globals.css'), 'utf8')
  const families = new Set<string>()
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const m = block[1]!.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/)
    if (m) families.add(m[1]!.trim().toLowerCase())
  }
  return families
}

/**
 * 拆出一条 font-family 值里的具名族。
 *
 * 要处理三种写法，其中第三种是这个函数第一版写错的地方：
 *   font-family: 'CabinSketch', cursive;                 → ['CabinSketch','cursive']
 *   fontFamily: "'CabinSketch-Bold', serif"              → ['CabinSketch-Bold','serif']
 *   fontFamily: 'var(--font-gallery, Georgia, serif)'    → ['Georgia','serif']
 * 最后一种若先按逗号切分，`var(--font-gallery` 会变成一个"族名"。所以先摘掉
 * 变量名、再抹掉括号，才轮到按逗号切分。
 */
function namedFamilies(value: string): string[] {
  const cleaned = value
    .replace(/var\(\s*--[\w-]+/g, '') // var(--x, A, B) → , A, B)
    .replace(/[()]/g, '')
  return cleaned
    .split(',')
    .map((part) => part.trim().replace(/^['"`]|['"`]$/g, '').trim())
    .filter((part) => part.length > 0 && !part.startsWith('--'))
}

/**
 * 取出 `font-family:` / `fontFamily:` 后面的完整值。
 *
 * 值本身含逗号，所以不能按逗号截断；也不能直接取到行尾——单行内联样式对象
 * （`{ fontFamily: "…", fontSize: 12 }`）会把后面的属性一起吞进来。按文件
 * 类型分别处理：JSX 的值是一个字符串字面量（取到配对引号），CSS 的值到分号。
 */
function fontFamilyValue(line: string, isCss: boolean): string | null {
  const m = line.match(/(?:fontFamily|font-family)\s*:\s*/)
  if (!m || m.index === undefined) return null
  const rest = line.slice(m.index + m[0].length)

  if (isCss) {
    return rest.split(/[;}]/)[0]!.trim()
  }

  const quote = rest[0]
  if (quote !== '"' && quote !== "'" && quote !== '`') return null // 变量引用等，无具名族
  const end = rest.indexOf(quote, 1)
  if (end === -1) return null
  return rest.slice(1, end)
}

/**
 * next/font 加载的族名。
 *
 * 它们通过 CSS 变量（`--font-display` 等）使用；真实 family 名是构建期生成的
 * 哈希串，所以代码里写的字面量 `"Cormorant Garamond"` 其实永远不会命中——但那
 * 只是无用的 fallback 文本，不是本测试要抓的"字体根本没加载"。放进白名单。
 */
function nextFontFamilies(): Set<string> {
  const layout = readFileSync(join(APP_ROOT, 'app/layout.tsx'), 'utf8')
  const m = layout.match(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/)
  if (!m) return new Set()
  return new Set(
    m[1]!
      .split(',')
      .map((name) => name.trim().replace(/_/g, ' ').toLowerCase())
      .filter(Boolean),
  )
}

interface Reference {
  file: string
  line: number
  family: string
}

function collectFontFamilyReferences(): Reference[] {
  const files = [
    ...walk(join(APP_ROOT, 'components')),
    ...walk(join(APP_ROOT, 'app')),
  ].filter((f) => /\.(tsx?|css)$/.test(f))

  const refs: Reference[] = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const isCss = file.endsWith('.css')
    // 刻意跳过 @font-face 块本身：那里的 font-family 是**声明**而非引用
    const withoutFontFace = source.replace(/@font-face\s*\{[^}]*\}/g, '')
    withoutFontFace.split('\n').forEach((line, i) => {
      const value = fontFamilyValue(line, isCss)
      if (value === null) return
      for (const family of namedFamilies(value)) {
        refs.push({ file: file.replace(`${APP_ROOT}/`, ''), line: i + 1, family })
      }
    })
  }
  return refs
}

describe('font-family 引用的族名必须真实存在（审计 E1）', () => {
  const declared = declaredFontFaceFamilies()
  const viaNextFont = nextFontFamilies()
  const refs = collectFontFamilyReferences()

  it('globals.css 确实声明了 CabinSketch —— 前提校验，防止测试自身失效', () => {
    expect(declared).toContain('cabinsketch')
  })

  it('识别出了 next/font 加载的族 —— 同上，前提校验', () => {
    expect(viaNextFont.size).toBeGreaterThanOrEqual(3)
  })

  it('扫描到了足够多的引用点 —— 防止正则失效后测试变成空跑', () => {
    // 变异测试：把 fontFamilyValue 改坏后这条会红。审计时全仓 40+ 处 font-family。
    expect(refs.length).toBeGreaterThan(25)
  })

  it('没有任何引用指向未声明的族名', () => {
    const unknown = refs.filter(({ family }) => {
      const key = family.toLowerCase()
      return !declared.has(key) && !SYSTEM_FAMILIES.has(key) && !viaNextFont.has(key)
    })

    const report = unknown
      .map(({ file, line, family }) => `  ${file}:${line}  → "${family}"`)
      .join('\n')

    expect(unknown, `以下族名既没有 @font-face 声明也不是系统字体：\n${report}`)
      .toEqual([])
  })
})

/**
 * 去掉注释再匹配。
 *
 * 第一版没做这件事，于是「解释这个 pattern 为什么被禁」的注释本身触发了断言。
 * 规则约束的是**代码**，不是叙述——写代码的人应当能在注释里讨论被禁的写法。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('主题色必须走 token（审计 E2）', () => {
  it('Navbar 不写死深色主题的 --bg-base —— 否则浅色主题下滚动后是深色条', () => {
    const navbar = stripComments(
      readFileSync(join(APP_ROOT, 'components/layout/Navbar.tsx'), 'utf8'),
    )
    // 深色 --bg-base 是 #070b12 = rgb(7,11,18)。两种写法都禁。
    expect(navbar).not.toMatch(/rgba?\(\s*7\s*,\s*11\s*,\s*18/)
    expect(navbar.toLowerCase()).not.toContain('#070b12')
  })

  it('stripComments 只吃注释，不吃代码 —— 前提校验', () => {
    expect(stripComments("a\n// rgba(7,11,18)\nb")).not.toContain('rgba')
    expect(stripComments("/* rgba(7,11,18) */")).not.toContain('rgba')
    expect(stripComments("const u = 'https://x.com/y'")).toContain('https://x.com/y')
    expect(stripComments("background: 'rgba(7,11,18,0.8)'")).toContain('rgba')
  })
})
