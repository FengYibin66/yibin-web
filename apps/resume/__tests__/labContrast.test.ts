import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  WCAG_AA,
  composite,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from '@/lib/a11y/contrast'
import {
  CORRIDOR_PAPER,
  ENTRY_COLORS,
  ENTRY_PAPER,
  OVERLAY_COLORS,
} from '@/lib/lab/domain/overlayColors'

import type { ColorHit } from './helpers/sourceScan'
import { colorLiterals, scanTree } from './helpers/sourceScan'

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

  it('次要说明文字过 AA 正文门槛（9–12px 小字）', () => {
    const ratio = contrastRatio(OVERLAY_COLORS.mutedText, CORRIDOR_PAPER)
    expect(ratio, `对比度只有 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA.normalText)
  })

  it('原先那两个值确实不达标 —— 记录问题的量级，防止改回去', () => {
    expect(contrastRatio('rgba(42,31,14,0.4)', CORRIDOR_PAPER)).toBeLessThan(3)
    expect(contrastRatio('rgba(200,169,110,0.6)', CORRIDOR_PAPER)).toBeLessThan(3)
  })
})

describe('入口页文案在它自己的米底上可读', () => {
  /*
    与 Lab 覆盖层分开断言：背景不同（`ENTRY_PAPER` vs `CORRIDOR_PAPER`），
    同一个颜色在两处的对比度不一样。用错背景算出来的是个看起来很精确的错数字。
  */
  it('金色强调文字过 AA 正文门槛', () => {
    const ratio = contrastRatio(ENTRY_COLORS.gold, ENTRY_PAPER)
    expect(ratio, `对比度只有 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA.normalText)
  })

  it('方向标签过 AA 正文门槛（9px 小字）', () => {
    const ratio = contrastRatio(ENTRY_COLORS.tag, ENTRY_PAPER)
    expect(ratio, `对比度只有 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA.normalText)
  })

  it('金色仍然是金色 —— 只是压深，不是换成棕黑', () => {
    /*
      「达标」很容易靠"改成近黑色"实现，那等于放弃这个品牌口子。这条断言把
      色相钉住：红 > 绿 > 蓝，且红蓝差足够大（暖色）。
    */
    const gold = parseColor(ENTRY_COLORS.gold)!
    expect(gold.rgb.r).toBeGreaterThan(gold.rgb.g)
    expect(gold.rgb.g).toBeGreaterThan(gold.rgb.b)
    expect(gold.rgb.r - gold.rgb.b).toBeGreaterThan(60)
  })

  it('原先那四处确实不达标 —— 记录问题的量级', () => {
    expect(contrastRatio('rgba(200,169,110,0.7)', ENTRY_PAPER)).toBeLessThan(2)
    expect(contrastRatio('#c8a96e', ENTRY_PAPER)).toBeLessThan(2.5)
    expect(contrastRatio('#9c8570', ENTRY_PAPER)).toBeLessThan(WCAG_AA.normalText)
  })
})

// ─── 门禁：界面组件里不再内联写低对比的颜色 ──────────────────────────────────

const ROOT = join(import.meta.dirname, '..')

/**
 * 扫描范围与各自的背景色。
 *
 * 背景要按区域给，不能一刀切：Lab 的覆盖层压在走廊纸白上，入口页压在它自己的
 * 米色上，两者不同。用错背景算出来的对比度是个看起来很精确的错数字。
 */
const SCAN_AREAS: readonly { dir: string, background: string, why: string }[] = [
  {
    dir: 'components/lab',
    background: CORRIDOR_PAPER,
    why: 'Lab 覆盖层压在走廊的纸白上（取最亮那面墙，最坏情况）',
  },
  {
    dir: 'components/ui',
    background: CORRIDOR_PAPER,
    why: '导航 / 成就 / 音频面板都浮在 Lab 之上',
  },
  {
    dir: 'components/entry',
    background: ENTRY_PAPER,
    why: '入口页压在它自己的米色底上，与走廊纸白不同（差一点，但要分开算）',
  },
]

/**
 * 这道门禁**看不到**的地方，列在这里以免被当成"已覆盖"。
 *
 * 1. **CSS module 里的颜色。** 扫描器读的是 TS/TSX 里的内联对象字面量；
 *    `.module.css` 需要 CSS 解析器，是另一件事。`RoomLoadingIndicator` 的错误
 *    详情就落在这个盲区里：颜色在 `styles.error`、`opacity: 0.6` 在 JSX 上，
 *    两处都不在同一个对象字面量里——实算约 2.5，而本门禁测得 0 条违规。
 *    2026-09-03 的复核是靠人同时读 CSS 与 JSX 才发现的。
 * 2. **祖先节点的 `opacity`。** 只查同一个 style 对象里的 `opacity`；
 *    父元素上的 `opacity` 会再乘一次，看不到。
 * 3. **Tailwind 的透明度工具类**（`text-ink` 加斜杠 40 那种写法）。颜色不以
 *    字面量形式出现。（这里刻意不写出那个斜杠形态——它含 `*` 加斜杠，会把本
 *    块注释提前关掉，第一版就栽在这上面。）
 * 4. **`app/` 下的页面。** 入口页 `app/page.tsx` 的 tagline / footer 实算
 *    2.71 / 1.67，但那一批与 `<head>` metadata 的本地化一起属于入口页的独立
 *    整理，不在 Lab 覆盖层这道门禁的范围里。
 *
 * 前两条的正解都是**把颜色收进 `OVERLAY_COLORS` 之类的常量**——那样就落进本
 * 文件顶部那组显式断言的覆盖范围，不再依赖扫描。
 */

/**
 * WCAG 2.1 的门槛，按属性分。
 *
 * 正则版只看 `color:` 且一律用 3:1（大字标准）。实际上这些覆盖层文案大多是
 * 9–12px 的小字，该按 4.5:1 的正文标准；而边框 / 背景这类非文字图形才是 3:1
 * （1.4.11 Non-text Contrast）。一刀切 3:1 会放过一整批小字。
 */
const THRESHOLDS: Readonly<Record<string, number>> = {
  color: WCAG_AA.normalText,
  borderColor: WCAG_AA.uiComponent,
  borderTopColor: WCAG_AA.uiComponent,
  borderBottomColor: WCAG_AA.uiComponent,
  borderLeftColor: WCAG_AA.uiComponent,
  borderRightColor: WCAG_AA.uiComponent,
  outlineColor: WCAG_AA.uiComponent,
}

/**
 * 已知的低对比，按文件记条数。棘轮只能往下。
 *
 * **现在是空的。** 这张表原来有 4 个文件 / 9 条，是 2026-09-03 复核实算出来的
 * 存量——审计 E10 只修了 `OVERLAY_COLORS` 里那两个常量，而第一版门禁只认
 * `rgba()`、不认 `#hex`、也不看 `opacity` 的二次衰减，所以入口页那四处金色
 * （1.59 / 1.98 / 1.98 / 3.08）与三处墨色小字（3.11 / 3.58 / 4.14）一直是绿的。
 *
 * 九处已全部收进 `OVERLAY_COLORS.mutedText` / `ENTRY_COLORS.gold` /
 * `ENTRY_COLORS.tag`，于是它们落进本文件顶部那组**显式常量断言**的覆盖范围
 * ——不再依赖扫描能不能看见内联样式，也就绕不过盲区（CSS module、祖先 opacity、
 * Tailwind 工具类）。
 *
 * 表空着而不是删掉，是因为它是机制的一部分：下一处低对比出现时，
 * 「没有新增的低对比颜色」那条会直接红，而不是被悄悄加进一张有先例的表里。
 */
const KNOWN_LOW_CONTRAST: Readonly<Record<string, { count: number, note: string }>> = {}

interface Violation {
  readonly line: number
  readonly color: string
  readonly property: string
  readonly ratio: number
  readonly threshold: number
  readonly opacity: number | null
}

/**
 * 按文件覆盖背景色。
 *
 * 区域默认背景对个别组件是错的，而**用错背景算出来的对比度是个看起来很精确的
 * 错数字**——第一版据此把 `ImagePreview` 的青色文字判成 1.23（实际它压在深色
 * 遮罩上，是高对比）。宁可显式登记，不要让门禁产出假结论：门禁误报的代价是
 * 逼人加豁免，而豁免加多了就等于门禁不存在。
 */
const BACKGROUND_OVERRIDES: Readonly<Record<string, { background: string, why: string }>> = {
  'components/ui/ImagePreview.tsx': {
    background: 'rgb(7,11,18)',
    why: '灯箱不在 Lab 的纸白上：遮罩是 rgba(7,11,18,0.88)，悬浮层还叠 bg-black/45',
  },
}

/** 把颜色的 alpha 与同级 opacity 相乘后算对比度；有局部背景就用它 */
function effectiveRatio(hit: ColorHit, areaBackground: string, fileBackground?: string): number {
  const parsed = parseColor(hit.color)
  if (!parsed) return Number.NaN
  const alpha = hit.opacity === null ? parsed.alpha : parsed.alpha * hit.opacity
  const { r, g, b } = parsed.rgb
  // 优先级：同一个 style 对象自己声明的背景 > 按文件覆盖 > 区域默认
  const under = hit.localBackground ?? fileBackground ?? areaBackground
  const background = resolveBackground(under, fileBackground ?? areaBackground)
  return contrastRatio(`rgba(${r},${g},${b},${alpha})`, background)
}

/** 半透明背景要先压到它下面那层上，否则 `parseColor` 的 alpha 会被丢掉 */
function resolveBackground(background: string, beneath: string): string {
  const parsed = parseColor(background)
  const base = parseColor(beneath)
  if (!parsed || !base || parsed.alpha >= 1) return background
  const { r, g, b } = composite(parsed.rgb, parsed.alpha, base.rgb)
  return `rgb(${r},${g},${b})`
}

function scanContrast(): Map<string, Violation[]> {
  const found = new Map<string, Violation[]>()
  for (const area of SCAN_AREAS) {
    const hits = scanTree(ROOT, [area.dir], colorLiterals)
    for (const [file, colors] of hits) {
      const override = BACKGROUND_OVERRIDES[file]
      const bad: Violation[] = []
      for (const hit of colors) {
        // 不是 CSS 样式对象就不判：`CORRIDOR_FOG = { color, near, far }` 是
        // three.js 的雾配置，属性名也叫 color
        if (!hit.inStyle) continue
        const threshold = THRESHOLDS[hit.property]
        if (threshold === undefined) continue
        const ratio = effectiveRatio(hit, area.background, override?.background)
        if (Number.isNaN(ratio) || ratio >= threshold) continue
        bad.push({
          line: hit.line,
          color: hit.color,
          property: hit.property,
          ratio,
          threshold,
          opacity: hit.opacity,
        })
      }
      if (bad.length > 0) found.set(file, bad)
    }
  }
  return found
}

describe('界面组件不内联写低对比颜色', () => {
  const violations = scanContrast()
  const show = (file: string) =>
    (violations.get(file) ?? [])
      .map(v =>
        `${v.line} ${v.property}: ${v.color}` +
        (v.opacity === null ? '' : ` × opacity ${v.opacity}`) +
        ` → ${v.ratio.toFixed(2)}（需 ${v.threshold}）`)
      .join('\n      ')

  it('没有新增的低对比颜色', () => {
    const unlisted = [...violations.keys()].filter(f => !(f in KNOWN_LOW_CONTRAST)).sort()
    expect(
      unlisted,
      '这些内联颜色在各自背景上达不到 WCAG AA（审计 E10）。放进 ' +
      '`lib/lab/domain/overlayColors` 并让本文件的常量断言覆盖它：\n' +
      unlisted.map(f => `\n  ${f}\n      ${show(f)}`).join(''),
    ).toEqual([])
  })

  it('已知低对比没有变多 —— 棘轮只能往下', () => {
    const grown: string[] = []
    for (const [file, { count }] of Object.entries(KNOWN_LOW_CONTRAST)) {
      const actual = violations.get(file)?.length ?? 0
      if (actual > count) grown.push(`${file}：登记 ${count} 条，实际 ${actual}\n      ${show(file)}`)
    }
    expect(grown, grown.join('\n\n')).toEqual([])
  })

  it('登记数与实测一致 —— 修好了就把数字改小', () => {
    const stale: string[] = []
    for (const [file, { count }] of Object.entries(KNOWN_LOW_CONTRAST)) {
      const actual = violations.get(file)?.length ?? 0
      if (actual < count) stale.push(`${file}：登记 ${count}，实际 ${actual}`)
    }
    expect(stale, '改成实际值，为 0 则删掉整行：\n' + stale.join('\n')).toEqual([])
  })

  it('KNOWN_LOW_CONTRAST 里没有僵尸条目', () => {
    const zombies = Object.keys(KNOWN_LOW_CONTRAST).filter(f => !violations.has(f))
    expect(zombies, '这些文件已经没有低对比颜色了，删掉').toEqual([])
  })
})

describe('对比度扫描器没有退化', () => {
  /*
    正则版只匹配 `color: 'rgba(...)'`。下面前三条它一条都抓不到，而第三条
    （opacity 二次衰减）是最隐蔽的一类：颜色本身看着够，乘上同级 opacity 之后
    不够，而代码里两个数字离得很远。
  */
  const probes: readonly [name: string, code: string, expectBad: boolean][] = [
    ['✗ hex 小字', "const s = { color: '#c8a96e', fontSize: 10 }", true],
    ['✗ rgb()', "const s = { color: 'rgb(200,180,150)', fontSize: 10 }", true],
    ['✗ opacity 二次衰减', "const s = { color: 'rgba(42,31,14,0.68)', opacity: 0.3, fontSize: 10 }", true],
    ['rgba 低 alpha', "const s = { color: 'rgba(42,31,14,0.2)', fontSize: 10 }", true],
    ['不透明深墨色是合格的', "const s = { color: '#2a1f0e', fontSize: 10 }", false],
    ['背景色不按文字标准判', "const s = { background: '#f8f6f0', padding: 4 }", false],
    ['认不出的颜色不假装算出结果', "const s = { color: 'var(--ink)', fontSize: 10 }", false],
    // 领域配置对象不判：属性名叫 color，但它不是 CSS
    ['三维雾配置不算样式', "const f = { color: '#f0ece4', near: 15, far: 60 }", false],
    ['材质参数不算样式', "const m = { color: '#ffffff', roughness: 0.4 }", false],
    // 局部背景优先：浅色文字压在自己声明的深底上是合格的
    ['自带深色背景时按它算', "const s = { color: '#7fe9ff', background: 'rgb(7,11,18)', padding: 4 }", false],
  ]

  it.each(probes)('%s', (_name, code, expectBad) => {
    const bad = colorLiterals(code, 'probe.ts').filter(hit => {
      if (!hit.inStyle) return false
      const threshold = THRESHOLDS[hit.property]
      if (threshold === undefined) return false
      const ratio = effectiveRatio(hit, CORRIDOR_PAPER)
      return !Number.isNaN(ratio) && ratio < threshold
    })
    expect(bad.length > 0, code).toBe(expectBad)
  })

  it('style={{…}} 里的颜色即使没有别的 CSS 属性也算样式', () => {
    const code = "const el = <p style={{ color: '#c8a96e' }} />"
    const [hit] = colorLiterals(code, 'probe.tsx')
    expect(hit!.inStyle).toBe(true)
  })

  it('每条背景覆盖都写了理由', () => {
    for (const [file, { background, why }] of Object.entries(BACKGROUND_OVERRIDES)) {
      expect(why.length, file).toBeGreaterThan(10)
      expect(parseColor(background), file).not.toBeNull()
    }
  })

  it('小字按 4.5 判而不是 3 —— 一刀切 3 会放过一整批', () => {
    expect(THRESHOLDS.color).toBe(WCAG_AA.normalText)
    expect(WCAG_AA.normalText).toBeGreaterThan(WCAG_AA.uiComponent)
  })

  it('扫描确实覆盖到了文件 —— 目录写错会让门禁静默变成空扫描', () => {
    const total = SCAN_AREAS.reduce(
      (sum, area) => sum + scanTree(ROOT, [area.dir], colorLiterals).size,
      0,
    )
    expect(total).toBeGreaterThan(5)
  })

  it('每个扫描区域都写了背景色的理由', () => {
    for (const area of SCAN_AREAS) {
      expect(area.why.length, area.dir).toBeGreaterThan(10)
      expect(parseColor(area.background), area.dir).not.toBeNull()
    }
  })
})
