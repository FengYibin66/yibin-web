import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { content, type Locale } from '@/lib/content'
import { ROOM_IDS } from '@/lib/lab/domain/ids'
import {
  LAB_FONT_CJK,
  LAB_FONT_DISPLAY,
  LAB_FONT_LATIN_BOLD,
  LAB_FONT_LATIN_REGULAR,
  fontForText,
  getLabFonts,
  needsCjkFont,
} from '@/lib/lab/domain/labFonts'

import { scanTree, userStrings } from './helpers/sourceScan'

/**
 * 3D 文字的字体覆盖（修的是审计 E8 的同类复发）。
 *
 * ## 这组测试守的到底是什么
 *
 * drei 的 `<Text>`（troika）遇到字体覆盖不到的字符时，**会去一个外部 CDN 取兜底
 * 字体**——默认是
 * `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data`。
 * 所以「字体选错」的后果不是"字丑一点"，而是：
 *
 * - 能连上 jsDelivr → 渲染成 Noto Sans 黑体，与全站手写体不统一
 * - **连不上（大陆访客）→ 那段文字整个空白**
 *
 * 走廊门牌就是这么漏的：写死 `CabinSketch-Bold.ttf`，而它没有汉字字形。中文用户
 * 进走廊看到的是五扇空白门牌，而门牌是唯一说明"这扇门后面是什么"的信息。
 *
 * 审计 E8（鸭子对话框漏 `font` 属性 → 去 fonts.gstatic.com 拉字体 → 大陆失败）
 * 修的是同一件事的另一处，修法是"补上 font 属性"——治症状。这一组治根因：
 * **含汉字的文案，选中的字体必须是有汉字字形的那一款。**
 *
 * ## 为什么不去解析 TTF 的 cmap
 *
 * 真正严格的做法是读字体文件的字符映射表，逐字确认覆盖。那需要一个字体解析器
 * （`fontTools` 在 Python 那条流水线里有，TS 侧没有），而在 TS 里再实现一遍
 * 就是第二份实现、迟早与本体不一致——那正是这套门禁要防的事。
 *
 * 所以这里断言的是**选择逻辑**（含汉字 → 必须选 CJK 那一款）加**子集覆盖**
 * （`subset-fonts.py` 扫的字符范围包含这些文案，已由 `fontSubset.test.ts` 守着）。
 * 两条合起来等价于"覆盖得到"，且没有第二份实现。
 */

const ROOT = join(import.meta.dirname, '..')
const LOCALES: readonly Locale[] = ['en', 'zh']
const ALL_FACES = [
  LAB_FONT_CJK,
  LAB_FONT_LATIN_BOLD,
  LAB_FONT_LATIN_REGULAR,
  LAB_FONT_DISPLAY,
] as const

function fontFileExists(url: string): boolean {
  return existsSync(join(ROOT, 'public', url.replace(/^\//, '')))
}

describe('getLabFonts 的选择逻辑', () => {
  it('zh 的标题与正文都用 CJK 手写体', () => {
    const fonts = getLabFonts('zh')
    expect(fonts.bold).toBe(LAB_FONT_CJK)
    expect(fonts.regular).toBe(LAB_FONT_CJK)
  })

  it('en 用拉丁手写体', () => {
    const fonts = getLabFonts('en')
    expect(fonts.bold).toBe(LAB_FONT_LATIN_BOLD)
    expect(fonts.regular).toBe(LAB_FONT_LATIN_REGULAR)
  })

  it('latinBold 两种语言都是拉丁体 —— 会议名 / DOI 这类本来就是拉丁字符', () => {
    for (const locale of LOCALES) {
      expect(getLabFonts(locale).latinBold, locale).toBe(LAB_FONT_LATIN_BOLD)
    }
  })

  it('三个字体文件都真实存在 —— 不存在时 troika 会 404 然后落到外网兜底', () => {
    for (const url of ALL_FACES) {
      expect(fontFileExists(url), `${url} 不存在`).toBe(true)
    }
  })

  it('都是 troika 支持的格式 —— 它不支持 woff2', () => {
    for (const url of ALL_FACES) {
      expect(url, `${url} 不是 ttf/otf/woff`).toMatch(/\.(ttf|otf|woff)$/)
    }
  })
})

describe('needsCjkFont', () => {
  it('认得常用汉字', () => {
    for (const text of ['关于', '项目', '论文', '相册', '联系', '退出 Lab']) {
      expect(needsCjkFont(text), text).toBe(true)
    }
  })

  it('纯拉丁文案不需要', () => {
    for (const text of ['About', 'Projects', 'ENTER →', 'CSCW 2025', '']) {
      expect(needsCjkFont(text), text).toBe(false)
    }
  })

  it('中英混排也需要 —— 只要有一个汉字就得换字体', () => {
    expect(needsCjkFont('退出 Lab')).toBe(true)
    expect(needsCjkFont('Lab 实验室')).toBe(true)
  })
})

describe('fontForText：按文案内容选，而不是按 locale', () => {
  it('含汉字 → CJK 体', () => {
    expect(fontForText('关于', LAB_FONT_LATIN_BOLD)).toBe(LAB_FONT_CJK)
    expect(fontForText('退出 Lab', LAB_FONT_DISPLAY)).toBe(LAB_FONT_CJK)
  })

  it('纯拉丁 → **保留**调用方要的那款拉丁体', () => {
    /*
      这是它与"按 locale 选"的关键区别。Lab 里不止一款拉丁手写体：About 的
      大标题用 RubikScribble、正文用 CabinSketch。按 locale 一刀切会把 zh 下
      `YIBIN FENG`、`NUS 2023-2024` 这些拉丁文案的字形也换掉。
    */
    expect(fontForText('YIBIN FENG', LAB_FONT_DISPLAY)).toBe(LAB_FONT_DISPLAY)
    expect(fontForText('NUS 2023-2024', LAB_FONT_LATIN_BOLD)).toBe(LAB_FONT_LATIN_BOLD)
    expect(fontForText('AI Research Engineer', LAB_FONT_LATIN_REGULAR))
      .toBe(LAB_FONT_LATIN_REGULAR)
  })

  it('空文案不崩，返回拉丁体', () => {
    expect(fontForText('', LAB_FONT_LATIN_BOLD)).toBe(LAB_FONT_LATIN_BOLD)
  })
})

describe('实际会被渲染的文案：字体都覆盖得到', () => {
  /*
    这是这组测试的核心。它逐条取**真实会进 `<Text>` 的字符串**，用运行时同一个
    函数算出字体，再断言"含汉字的必须落到 CJK 体"。

    为什么不只测门牌：加上门禁之后扫出 14 处写死的字体路径，其中 About 房间的
    `tagline`（`构建能够理解并影响人类行为的智能系统。…`）、`journeyTitle`
    （`旅程`）、`journeySubtitle`（`教育与经历`）都在用拉丁体渲染——**中文用户
    进 About 看到的是走外网兜底的文字，连不上就是空白**。审计只记了门牌那一处
    （E8 的同类复发），实际是全站性的。
  */
  function labTexts(locale: Locale): { where: string, text: string }[] {
    const c = content[locale]
    const out: { where: string, text: string }[] = []

    for (const roomId of ROOM_IDS) {
      out.push({ where: `门牌/${roomId}`, text: c.labUi.doors[roomId] })
    }
    // About 房间的 3D 文案（经 labAdapters 派生，这里取它的输入）
    out.push({ where: 'about/name', text: c.hero.name })
    out.push({ where: 'about/tagline', text: c.hero.tagline })
    for (const [i, role] of c.hero.roles.entries()) {
      out.push({ where: `about/role[${i}]`, text: role })
    }
    return out.filter(entry => typeof entry.text === 'string' && entry.text.length > 0)
  }

  it.each(LOCALES)('%s 的每段 3D 文案都选到能覆盖它的字体', locale => {
    const offenders: string[] = []
    for (const { where, text } of labTexts(locale)) {
      // 调用方给的拉丁体是哪一款不影响这条断言：含汉字时必须被换掉
      const chosen = fontForText(text, LAB_FONT_LATIN_BOLD)
      if (needsCjkFont(text) && chosen !== LAB_FONT_CJK) {
        offenders.push(`${where}：「${text.slice(0, 24)}」→ ${chosen}`)
      }
    }
    expect(
      offenders,
      '这些文案含汉字但没落到 CJK 体，troika 会去 jsDelivr 取兜底字体，' +
      '大陆访客看到空白：\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('zh 的文案里确实有汉字 —— 否则上面那条是空断言', () => {
    const han = labTexts('zh').filter(entry => needsCjkFont(entry.text))
    expect(
      han.length,
      'zh 的 3D 文案一个汉字都没有，说明中文化没做或者被改回英文了',
    ).toBeGreaterThanOrEqual(5)
  })

  it('zh 的门牌全部含汉字', () => {
    const withHan = ROOM_IDS.filter(id => needsCjkFont(content.zh.labUi.doors[id]))
    expect(withHan.length).toBe(ROOM_IDS.length)
  })
})

describe('没有别处再写死 3D 字体路径', () => {
  /*
    单一来源只有在"没人绕过它"时才成立。这条扫的是：除了 `labFonts.ts` 自己与
    转发用的 `publicationFonts.ts`，不该再有文件把 `/fonts/*.ttf` 直接写进
    `<Text>` 的 `font` 属性。

    用的是文本扫描而不是 AST：这里要找的是**字面量路径**，不涉及语法结构判断，
    正则够用且不会有 `sourceScan` 那类假阴性（路径不会出现在 JSX 文本里）。
  */
  const ALLOWED = new Set([
    // 常量本身的定义处
    'lib/lab/domain/labFonts.ts',
    // 转发到 labFonts，为了不改 Publications 那一堆调用点
    'components/rooms/publications/publicationFonts.ts',
    // 手写层（roughjs）画在 canvas 上用的是 CSS 族名与 TTF 路径，不走 troika
    'lib/lab/domain/sketch/types.ts',
  ])

  it('font= 属性不接受写死的路径', () => {
    const offenders: string[] = []
    const found = scanTree(ROOT, ['components', 'lib', 'hooks'], userStrings)
    for (const [file, hits] of found) {
      if (ALLOWED.has(file)) continue
      for (const hit of hits) {
        if (hit.owner !== 'font') continue
        if (!/^\/fonts\/.+\.(ttf|otf|woff)$/.test(hit.text)) continue
        offenders.push(`${file}:${hit.line}  font="${hit.text}"`)
      }
    }
    expect(
      offenders,
      '这些地方把 3D 字体路径写死了。改成 `fontForText(文案, LAB_FONT_*)`——' +
      '写死拉丁体会让中文文案落到外网兜底字体（大陆访客看到空白）：\n' +
      offenders.join('\n'),
    ).toEqual([])
  })
})
