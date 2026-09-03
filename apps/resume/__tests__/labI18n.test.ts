import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { content } from '@/lib/content'
import { ROOM_IDS } from '@/lib/lab/domain/ids'

import type { UserString } from './helpers/sourceScan'
import { scanTree, userStrings } from './helpers/sourceScan'

/**
 * Lab 界面文案的门禁（审计 E7）。
 *
 * E7 的形态是：只有房间**内容**接了 `useLocale`，界面壳子（门牌、地图、加载
 * 提示、教程、成就）全是硬编码英文。中文用户看到的是"英文壳子包着中文内容"。
 *
 * 这类问题不会报错，也不会在英文环境下被发现——只有中文用户看得到。所以要
 * 三条机制守着：
 *
 *   1. en / zh 的键**完全一致**（漏一个键 TypeScript 会报，但漏一个**语言**
 *      不会：`Record` 的值可以是任意 string，写成英文照样过编译）
 *   2. 中文文案里真的有汉字（把英文原文复制过去是最常见的"假翻译"）
 *   3. Lab 的组件里不再出现界面用的英文字面量
 */

const ROOT = join(import.meta.dirname, '..')

/** 递归取出对象的全部叶子路径 */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value).flatMap(leafValues)
}

describe('en / zh 的 labUi 结构一致', () => {
  it('键完全一致 —— 漏一个语言不会被类型系统抓到', () => {
    const en = leafPaths(content.en.labUi).sort()
    const zh = leafPaths(content.zh.labUi).sort()
    expect(zh).toEqual(en)
  })

  it('没有空文案', () => {
    for (const locale of ['en', 'zh'] as const) {
      for (const [path, value] of Object.entries(flatten(content[locale].labUi))) {
        expect(value.trim().length, `${locale}.${path} 是空的`).toBeGreaterThan(0)
      }
    }
  })

  it('每个房间都有门牌 —— 缺一个的话那扇门是空白', () => {
    for (const locale of ['en', 'zh'] as const) {
      for (const roomId of ROOM_IDS) {
        expect(
          content[locale].labUi.doors[roomId],
          `${locale} 缺 ${roomId} 的门牌`,
        ).toBeTruthy()
      }
    }
  })

  it('中文文案里有汉字 —— 把英文复制过去是最常见的"假翻译"', () => {
    const exempt = new Set([
      // 'Esc' 是键名，不翻译
      'hints.escape',
      // 'Lab' 是本站对那个 3D 视图的固有称呼
      'panels.exitLab',
      /*
        语言切换按钮的标签**刻意用目标语言**：zh 下它说 "Switch to English"，
        与它的可见文字（'EN'）一致。用当前语言写的话，切换控件对读不懂当前
        语言的用户就是不可用的。
      */
      'panels.toggleLanguage',
    ])
    for (const [path, value] of Object.entries(flatten(content.zh.labUi))) {
      if (exempt.has(path)) continue
      expect(
        /[一-鿿]/.test(value),
        `zh.${path} 里没有一个汉字：「${value}」`,
      ).toBe(true)
    }
  })

  it('英文文案里没有汉字 —— 反向的漏改', () => {
    // 同一条豁免：语言切换按钮的 en 标签是中文（"切换到中文"），见上
    const exempt = new Set(['panels.toggleLanguage'])
    for (const [path, value] of Object.entries(flatten(content.en.labUi))) {
      if (exempt.has(path)) continue
      expect(/[一-鿿]/.test(value), `en.${path} 混进了中文：「${value}」`).toBe(false)
    }
  })

  it('en 与 zh 的对应文案不相同 —— 相同基本就是没翻', () => {
    const en = flatten(content.en.labUi)
    const zh = flatten(content.zh.labUi)
    const same = Object.keys(en).filter(k => en[k] === zh[k])
    /*
      白名单目前是空的。

      我原本以为 `hints.escape` 两边都是 'Esc' 所以要豁免——实际 en 写的是
      'Escape'、zh 写的是 'Esc'，并不相同。写测试时按印象填白名单，就会把
      "本该相同"和"其实不同"混为一谈；宁可先空着，真出现再逐个登记。
    */
    expect(same.sort(), '这些文案两种语言一字不差，确认是有意的再加进白名单')
      .toEqual([])
  })
})

function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof value === 'string') {
    out[prefix] = value
    return out
  }
  if (typeof value !== 'object' || value === null) return out
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}


// ─── Lab 壳子里不再有硬编码界面英文 ─────────────────────────────────────────

/**
 * 扫描范围：中文访客从落地到进房这条路上会看到的**界面壳子**。
 *
 * 不含 `app/` 的 `<head>` metadata（`title` / `description`）：静态导出下要做
 * per-locale metadata 得先有 per-locale 路由（`/zh/...`），那是一次独立的路由
 * 结构变更、需要单独的 ADR，与 E7「Lab 界面中文化」不是一件事。混进来会让这道
 * 门禁永远红着，而「跑必然失败的步骤只会训练人忽略红灯」。
 *
 * 房间**内容**不在这里——它们各自接 `useLocale` 走 `content` 的其余部分。
 */
const LAB_UI_DIRS = [
  'components/lab',
  'components/ui',
  'components/entry',
] as const

/** 纯 3D / 数学 / 样式，无面向用户的文案 */
const EXEMPT_FILES = new Set<string>([
  'components/lab/CorridorGeometry.tsx',
  'components/lab/shaders/RevealMaterial.ts',
])

/**
 * 会被用户看到的 **JSX 属性**。
 *
 * `aria-label` 在列：它是屏幕阅读器用户唯一能读到的文案，不翻译等于对他们
 * 完全没做 i18n。`className` / `style` / `data-*` 不在列，所以 CSS 值那一大类
 * 天然不进视野——这是换 AST 之后才能做到的区分（正则眼里
 * `display: 'none'` 与 `label: 'none'` 一样）。
 */
const VISIBLE_ATTRS = new Set([
  'aria-label', 'aria-description', 'aria-valuetext', 'aria-placeholder',
  'title', 'alt', 'placeholder', 'label',
])

/** 会被用户看到的**对象属性名**（组件 props、配置对象里的文案字段） */
const VISIBLE_PROPS = new Set([
  'label', 'text', 'title', 'hint', 'message', 'caption', 'tooltip',
  'ariaLabel', 'description', 'heading', 'subtitle', 'placeholder', 'detail',
])

/**
 * 允许出现的英文：品牌名、技术名、键名、域名、本站固有称呼。
 *
 * 判断标准是「中文用户看到它不会觉得没翻译」。
 */
const ALLOWED_EXACT = new Set([
  'Lab', 'Classic', 'Gallery', 'GitHub', 'LinkedIn', 'WeChat',
  'Esc', 'Escape', 'Enter', 'Shift', 'Tab', 'WebGL',
  'ITOM', 'yibinfeng.com', 'resume.yibinfeng.com', 'Yibin Feng',
  '<', '/>', '—', '→', '←',
])

const HAS_LATIN = /[A-Za-z]/
const HAS_CJK = /[一-鿿]/

/**
 * 已知的漏译，按文件记**条数**。
 *
 * 与相机门禁同一个形态：棘轮只能往下。这些是 2026-09-03 复核查出的存量
 * （审计把 E7 记成「已做」，实际这一批一直在），修法（新增 `labUi` 键 +
 * `useLabLabels()` 取用）属于 ADR 20260903211302 那一批，不在换门禁这一步里
 * ——所以先如实登记，而不是把门禁调松到看不见它们。
 *
 * 修完一个文件就把它整行删掉；那是完成标记。
 */
/**
 * 已知的漏译，按文件记**条数**。
 *
 * 与相机门禁同一个形态：棘轮只能往下。修完一个文件就把它整行删掉；那是完成标记。
 *
 * 这张表原来有 10 个文件 / 20 条，是 2026-09-03 复核查出的存量（审计把 E7 记成
 * 「已做」，实际这一批一直在）。现在只剩一条，且它不是"还没做"而是**做不了**
 * ——理由写在下面。
 */
const KNOWN_LEAKS: Readonly<Record<string, { count: number, note: string }>> = {
  'components/lab/HeroText.tsx': {
    count: 1,
    note:
      '走廊欢迎区的 3D 标语 `<AI Engineer />`。这不是忘了翻译，而是**换文案要重做' +
      '排版**：那一行是三个独立的 `<Text>`（`<` / `AI Engineer` / `/>`），' +
      '`baseX` 与 `splitDir` 是按 "AI Engineer" 这 11 个拉丁字符的宽度逐个手调的' +
      '（相机靠近时它们会向两侧裂开）。换成中文（字宽不同、字数不同）需要重新' +
      '标定这些常量，属于带视觉后果的独立改动，混在 i18n 批里做不合适。' +
      '职称本身属于简历内容（`content.hero.roles`），而 zh 那份里它也是英文' +
      '（`AI Research Engineer`）——所以即便接上 content，中文用户看到的仍是英文，' +
      '真正要决定的是"中文语境下这个标语写什么"。',
  },
}

/** 一个字符串是否处在「用户会看到」的语法位置 */
function isUserFacing(hit: UserString): boolean {
  if (hit.context === 'import' || hit.context === 'path' || hit.context === 'key') return false
  // 开发者可见文案：用**语法位置**豁免，而不是放宽匹配
  if (hit.context === 'error' || hit.context === 'console') return false
  if (hit.kind === 'jsx') return true
  if (hit.owner === null) return false
  return VISIBLE_ATTRS.has(hit.owner) || VISIBLE_PROPS.has(hit.owner)
}

/** 看起来是未翻译的英文文案 */
function looksUntranslated(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  if (ALLOWED_EXACT.has(trimmed)) return false
  if (!HAS_LATIN.test(trimmed)) return false
  // 含汉字说明已经翻译过（`退出 Lab` 这类混合文案是合法的）
  if (HAS_CJK.test(trimmed)) return false
  return true
}

function scanLeaks(): Map<string, UserString[]> {
  const found = new Map<string, UserString[]>()
  const all = scanTree(ROOT, LAB_UI_DIRS, userStrings)
  for (const [file, hits] of all) {
    if (EXEMPT_FILES.has(file)) continue
    const leaks = hits.filter(h => isUserFacing(h) && looksUntranslated(h.text))
    if (leaks.length > 0) found.set(file, leaks)
  }
  return found
}

describe('Lab 壳子不硬编码英文', () => {
  const leaks = scanLeaks()
  const describeLeaks = (file: string) =>
    (leaks.get(file) ?? []).map(h => `${h.line} [${h.owner ?? h.kind}] 「${h.text}」`).join('\n      ')

  it('没有新增的漏译', () => {
    const unlisted = [...leaks.keys()].filter(f => !(f in KNOWN_LEAKS)).sort()
    expect(
      unlisted,
      '这些文件有硬编码的界面英文（审计 E7）。放进 `content[locale].labUi` 并用 ' +
      '`useLabLabels()` 取：\n' +
      unlisted.map(f => `\n  ${f}\n      ${describeLeaks(f)}`).join(''),
    ).toEqual([])
  })

  it('已知漏译没有变多 —— 棘轮只能往下', () => {
    const grown: string[] = []
    for (const [file, { count }] of Object.entries(KNOWN_LEAKS)) {
      const actual = leaks.get(file)?.length ?? 0
      if (actual > count) {
        grown.push(`${file}：登记 ${count} 条，实际 ${actual} 条\n      ${describeLeaks(file)}`)
      }
    }
    expect(grown, '这些文件的漏译变多了：\n' + grown.join('\n\n')).toEqual([])
  })

  it('登记数与实测一致 —— 修好了就把数字改小，否则棘轮留空档', () => {
    const stale: string[] = []
    for (const [file, { count }] of Object.entries(KNOWN_LEAKS)) {
      const actual = leaks.get(file)?.length ?? 0
      if (actual < count) stale.push(`${file}：登记 ${count}，实际 ${actual}`)
    }
    expect(
      stale,
      '这些文件的漏译比登记的少（修了一部分）。把数字改成实际值，' +
      '改成 0 就删掉整行：\n' + stale.join('\n'),
    ).toEqual([])
  })

  it('KNOWN_LEAKS 里没有僵尸条目', () => {
    const zombies = Object.keys(KNOWN_LEAKS).filter(f => !leaks.has(f))
    expect(zombies, '这些文件已经没有漏译了，从 KNOWN_LEAKS 删掉').toEqual([])
  })

  it('每条已知漏译都写了它是什么', () => {
    for (const [file, { note }] of Object.entries(KNOWN_LEAKS)) {
      expect(note.length, file).toBeGreaterThan(10)
    }
  })
})

describe('漏译扫描器没有退化', () => {
  /*
    正则版对这几种形态返回"无漏译"，而它们是最常见的写法。这几条防的是有人
    为了消红灯把判定改弱。扫描器本身的双向锁定在 `sourceScan.test.ts`。
  */
  const shouldCatch: readonly [name: string, code: string][] = [
    ['单个词的 JSX 文本（Back / Skip / Mute）', '<button>Back</button>'],
    ['✗ 模板字符串', 'const a = { label: `Back to corridor` }'],
    ['✗ 跨行 JSX 文本（prettier 折行后）', '<p>\n  Slow connection?\n  Open Classic View\n</p>'],
    ['✗ 带插值的模板串', 'const a = { label: `Preview ${alt}` }'],
    ['✗ URL 之后的同行文案', "const u = 'https://x.com'; const t = { label: 'Back to corridor' }"],
    ['aria-label（屏幕阅读器唯一能读到的文案）', '<b aria-label="Close panel" />'],
  ]

  it.each(shouldCatch)('抓到：%s', (_name, code) => {
    const hits = userStrings(code, 'probe.tsx').filter(h => isUserFacing(h) && looksUntranslated(h.text))
    expect(hits, code).not.toEqual([])
  })

  const shouldIgnore: readonly [name: string, code: string][] = [
    ['CSS 值', "const s = { display: 'none', position: 'absolute' }"],
    ['className', '<div className="flex items-center" />'],
    ['import 路径', "import x from 'some-module'"],
    ['资源路径', "const p = '/textures/corridor/a.webp'"],
    ['对象键名', "const o = { 'aria-hidden': true }"],
    ['开发者错误文案', "throw new Error('Missing room definition for door')"],
    ['console 输出', "console.warn('Something went wrong')"],
    ['已翻译（含汉字）', 'const a = { label: \'退出 Lab\' }'],
    ['混合文案也算已翻译', 'const a = { label: \'退出 Lab\' }'],
    ['品牌名与键名', '<span>Lab</span>'],
    ['注释里的英文句子', '// This is an English sentence\nconst a = 1'],
  ]

  it.each(shouldIgnore)('不误伤：%s', (_name, code) => {
    const hits = userStrings(code, 'probe.tsx').filter(h => isUserFacing(h) && looksUntranslated(h.text))
    expect(hits.map(h => h.text), code).toEqual([])
  })

  it('扫描确实覆盖到了文件 —— 目录写错会让门禁静默变成空扫描', () => {
    expect(scanTree(ROOT, LAB_UI_DIRS, userStrings).size).toBeGreaterThan(10)
  })
})
