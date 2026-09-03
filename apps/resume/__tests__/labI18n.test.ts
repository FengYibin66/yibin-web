import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { content } from '@/lib/content'
import { ROOM_IDS } from '@/lib/lab/domain/ids'

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

// ─── Lab 组件里不再有硬编码界面英文 ──────────────────────────────────────────

/** 只扫 Lab 的界面组件；房间内容自己接 useLocale，走 content 的其余部分 */
const LAB_UI_DIRS = [
  'components/lab',
  'components/ui',
] as const

/**
 * 这些文件里的英文字面量不算违规，各有原因。
 */
const EXEMPT_FILES = new Set<string>([
  // 纯 3D / 数学 / 样式，无面向用户的文案
  'components/lab/CorridorGeometry.tsx',
  'components/lab/shaders/RevealMaterial.ts',
])

/**
 * 允许出现的英文短语。
 *
 * 判断标准是「中文用户看到它不会觉得没翻译」：品牌名、技术名、键名、
 * 以及本站固有称呼。
 */
const ALLOWED_PHRASES = [
  'Lab', 'Classic', 'Gallery', 'GitHub', 'LinkedIn', 'WeChat',
  'Esc', 'Escape', 'Enter', 'Shift', 'Tab',
  'ITOM', 'yibinfeng.com',
]

/** 看起来像面向用户的英文句子/短语（两个以上英文单词，首字母大写开头） */
const SENTENCE = /\b[A-Z][a-z]+(?: [a-z]+){1,8}\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/** 去注释、去 import、去 className / style 里的值 */
function uiCode(source: string): string {
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
    if (two === '{/') {
      // JSX 注释 {/* ... */}
      const close = source.indexOf('*/}', i)
      if (close !== -1) { i = close + 3; continue }
    }
    out += source[i]
    i += 1
  }
  return out
    .split('\n')
    .filter(line => !/^\s*import\b/.test(line))
    // className / style / 路径 / aria 之外的属性名不看
    .filter(line => !/className=|styles\.|font-|fontFamily|\/textures\/|\/sounds\/|\/fonts\//.test(line))
    .join('\n')
}

describe('Lab 界面组件不再硬编码英文', () => {
  it('没有漏在外面的英文句子', () => {
    const offenders: string[] = []
    for (const dir of LAB_UI_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file)
        if (EXEMPT_FILES.has(rel)) continue
        const code = uiCode(readFileSync(file, 'utf8'))
        for (const [i, line] of code.split('\n').entries()) {
          // 只看字符串字面量与 JSX 文本
          const literals = [
            ...line.matchAll(/'([^']{4,60})'/g),
            ...line.matchAll(/"([^"]{4,60})"/g),
            ...line.matchAll(/>\s*([A-Z][^<>{}]{3,60})\s*</g),
          ].map(m => m[1]!)
          for (const literal of literals) {
            if (!SENTENCE.test(literal)) continue
            if (ALLOWED_PHRASES.some(p => literal.trim() === p)) continue
            offenders.push(`${rel}:${i + 1}  「${literal.trim()}」`)
          }
        }
      }
    }
    expect(
      offenders,
      '这些界面文案还是硬编码英文（审计 E7）。放进 content[locale].labUi 并用 ' +
      'useLabLabels() 取：\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('扫描器能抓到硬编码，也不误伤（自检）', () => {
    expect(SENTENCE.test('Back to corridor')).toBe(true)
    expect(SENTENCE.test('Close achievements')).toBe(true)
    // 单个词、驼峰标识符、路径不算句子
    expect(SENTENCE.test('Projects')).toBe(false)
    expect(SENTENCE.test('useLabLabels')).toBe(false)
    // 注释里的内容被剥掉
    expect(uiCode("// aria-label='Back to corridor'\nconst a = 1")).not.toContain('corridor')
    expect(uiCode('{/* Back to corridor */}\nconst a = 1')).not.toContain('corridor')
  })
})
