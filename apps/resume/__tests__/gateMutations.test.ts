import { describe, expect, it } from 'vitest'

import {
  cameraWrites,
  colorLiterals,
  eventTypeLiterals,
  userStrings,
} from './helpers/sourceScan'

/**
 * 门禁的变异清单（ADR 20260903211320 的验收标准）。
 *
 * ## 为什么要单独一个文件
 *
 * 2026-09-03 的独立 review 对三条正则门禁做了 20 次真实变异（改实现，看哪条
 * 测试变红），**10 个存活**。存活的变异不是"测试写少了"，是**门禁在那个形态上
 * 根本不存在**——而它当时被写进 AGENTS.md 说"已是机制，不再是约定"。
 *
 * 那 20 个形态在这里固化成清单，每一条标明当年是被杀（`killed`）还是存活
 * （`survived`）。这个文件回答一个具体问题：**换成 AST 之后，那 10 个存活的
 * 变异现在会不会红？**
 *
 * 判断门禁够不够用的标准不是"现在是绿的"，而是"构造 N 个绕过形态，有几个能
 * 活下来"。所以这份清单只能增，不能删——删掉一条就是把一个已知的绕过形态重新
 * 变成盲区。
 *
 * ## 这里不覆盖的变异
 *
 * review 那 20 个里有 10 个是**逻辑层**的变异（`HINT_ONLY = []`、`UNLOCK` 不
 * 插队、`AudioMixer` 去掉 `load()`、`freshness` 的 digest 忽略脚本…），它们当年
 * 就全部被杀，守它们的是各自的单测而不是源码扫描。手改派生产物那一条
 * （M14，当年存活）由 `scripts/media/freshness.mjs` 的产物指纹接管，验证方式是
 * 跑 `--check`，不在 vitest 里。
 */

/** 一条变异：给扫描器的样本，以及它必须被抓到 */
interface Mutation {
  /** review 里的编号 */
  readonly id: string
  /** 当年在正则版下的结果 */
  readonly then: 'killed' | 'survived'
  readonly what: string
  readonly code: string
}

// ────────────────────────────────────────────── 相机所有权

const CAMERA_MUTATIONS: readonly Mutation[] = [
  {
    id: 'M2a',
    then: 'killed',
    what: '在非白名单文件里写 camera.position.set',
    code: 'camera.position.set(0, 0, 0)',
  },
  {
    id: 'M2b',
    then: 'survived',
    what: 'camera.position.setZ —— WRITE_PATTERNS 没列 setX/setY/setZ',
    code: 'camera.position.setZ(5)',
  },
  {
    id: 'M2c',
    then: 'survived',
    what:
      'camera.rotation.set —— 正则只匹配 `rotation.[xyz] =`。' +
      'DoorSection.tsx 正在用这种写法，白名单注释里也登记过它是"四处违例之一"',
    code: 'camera.rotation.set(0, 1, 0)',
  },
  {
    id: 'M2d',
    then: 'survived',
    what: '别名 —— 正则锚定 `camera.` 字面量',
    code: 'const cam = camera\ncam.position.set(1, 2, 3)',
  },
  {
    id: 'M2f',
    then: 'survived',
    what: 'gsap.to(camera.rotation) —— 正则只有 gsap.to(camera.position',
    code: 'gsap.to(camera.rotation, { y: 1 })',
  },
  {
    id: 'M2g',
    then: 'survived',
    // 这条描述本身也踩了同一个坑：在单引号字符串里写裸撇号会把它提前关掉，
    // 所以下面用双引号。
    what:
      "JSX 文本里的撇号 —— 手写剥离器把它当字符串起点，" +
      '吞掉后面整段代码直到下一个引号，让其中所有写点隐身',
    code: "const a = <span>Don't touch</span>\ncamera.position.set(1, 2, 3)\nconst b = 'x'",
  },
  {
    id: 'M2h',
    then: 'survived',
    what: '字符串里的 URL —— `//` 被当成行注释起点，吞掉同行后续代码',
    code: "const u = 'https://example.com/x'; camera.lookAt(t)",
  },
  {
    id: 'M2i',
    then: 'survived',
    what: '矩阵写法 —— applyMatrix4 / multiplyScalar / fromArray 都不在正则里',
    code: 'camera.position.applyMatrix4(m)',
  },
  {
    id: 'M2j',
    then: 'survived',
    what: '相机自身的旋转方法 —— rotateX / rotateOnWorldAxis 不在正则里',
    code: 'camera.rotateX(0.1)',
  },
]

describe('相机门禁：20 个变异形态', () => {
  it.each(CAMERA_MUTATIONS.map(m => [`${m.id}（当年${m.then === 'survived' ? '存活' : '被杀'}）`, m] as const))(
    '%s',
    (_label, mutation) => {
      const hits = cameraWrites(mutation.code, 'mutation.tsx')
      expect(hits, `${mutation.id}：${mutation.what}`).not.toEqual([])
    },
  )

  it('当年存活的那几条现在全部会红', () => {
    const survived = CAMERA_MUTATIONS.filter(m => m.then === 'survived')
    expect(survived.length, '清单里应当保留当年存活的形态').toBeGreaterThanOrEqual(8)
    const stillAlive = survived.filter(m => cameraWrites(m.code, 'mutation.tsx').length === 0)
    expect(stillAlive.map(m => m.id), '这些绕过形态仍然存活').toEqual([])
  })
})

// ────────────────────────────────────────────────── 漏译

/** 与 `labI18n.test.ts` 同一条判定，复制在此以便独立验证扫描器 */
const VISIBLE_OWNERS = new Set([
  'aria-label', 'title', 'alt', 'placeholder', 'label', 'text', 'hint', 'message',
])

function leaks(code: string): string[] {
  return userStrings(code, 'mutation.tsx')
    .filter(h => {
      if (h.context !== 'value' && h.context !== 'jsxAttribute') return false
      if (h.kind === 'jsx') return true
      return h.owner !== null && VISIBLE_OWNERS.has(h.owner)
    })
    .filter(h => /[A-Za-z]/.test(h.text) && !/[一-鿿]/.test(h.text))
    .map(h => h.text)
}

const I18N_MUTATIONS: readonly Mutation[] = [
  {
    id: 'M3b',
    then: 'killed',
    what: '把 zh 文案整条换成纯英文 —— 这是正则版唯一抓得住的形态',
    code: "const t = { label: 'Scroll to explore' }",
  },
  {
    id: 'M7',
    then: 'survived',
    what:
      '跨行 JSX 文本 —— 正则要求 `>` 与 `<` 在同一行，' +
      'prettier 把长文案一折行就漏。这是最常见的形态',
    code: '<p>\n  Slow connection?\n  Open Classic View\n</p>',
  },
  {
    id: 'M7a',
    then: 'survived',
    what: '模板字符串 —— 正则只匹配引号字面量',
    code: 'const t = { label: `Back to corridor` }',
  },
  {
    id: 'M7b',
    then: 'survived',
    what: '字符串里的 URL 含 `//`，把同行后面的硬编码吞掉',
    code: "const u = 'https://example.com'; const t = { label: 'Back to corridor' }",
  },
  {
    id: 'M7c',
    then: 'survived',
    what:
      '单个词 —— 正则的 SENTENCE 要求两个以上单词，' +
      '于是 Back / Skip / Mute 这类按钮文字全部溜过去，' +
      '门禁报告"无漏译"而截图满屏英文',
    code: '<button>Back</button>',
  },
  {
    id: 'M7e',
    then: 'survived',
    what: 'aria-label —— 屏幕阅读器用户唯一能读到的文案',
    code: '<button aria-label="Close achievements panel" />',
  },
]

describe('漏译门禁：变异形态', () => {
  it.each(I18N_MUTATIONS.map(m => [`${m.id}（当年${m.then === 'survived' ? '存活' : '被杀'}）`, m] as const))(
    '%s',
    (_label, mutation) => {
      expect(leaks(mutation.code), `${mutation.id}：${mutation.what}`).not.toEqual([])
    },
  )

  it('开发者可见文案仍然不算漏译 —— 用语法位置豁免，不是放宽匹配', () => {
    /*
      M7d：review 构造 `throw new Error('Missing room definition for door')`，
      正则版把它判成漏译（误报）。误报的代价是逼人往豁免短语表里塞东西，
      而那等于逐步关掉门禁。
    */
    expect(leaks("throw new Error('Missing room definition for door')")).toEqual([])
    expect(leaks("console.warn('Something went wrong here')")).toEqual([])
  })
})

// ──────────────────────────────────────────────── 对比度

const CONTRAST_MUTATIONS: readonly Mutation[] = [
  {
    id: 'M8',
    then: 'survived',
    what: 'hex 颜色 —— 正则只匹配 rgba()',
    code: "const s = { color: '#d9d2c4', fontSize: 10 }",
  },
  {
    id: 'M8a',
    then: 'survived',
    what: 'rgb() 无 alpha 形式',
    code: "const s = { color: 'rgb(217,210,196)', fontSize: 10 }",
  },
  {
    id: 'M8b',
    then: 'survived',
    what:
      '同级 opacity 的二次衰减 —— 颜色本身看着够，乘上 opacity 之后不够，' +
      '而代码里两个数字离得很远',
    code: "const s = { color: 'rgba(42,31,14,0.68)', opacity: 0.3, fontSize: 10 }",
  },
]

describe('对比度门禁：变异形态', () => {
  const LOW_CONTRAST_ON_PAPER = 4.5

  it.each(CONTRAST_MUTATIONS.map(m => [`${m.id}（当年存活）`, m] as const))(
    '%s',
    (_label, mutation) => {
      const hits = colorLiterals(mutation.code, 'mutation.ts')
      const styled = hits.filter(h => h.inStyle && h.property === 'color')
      expect(styled, `${mutation.id}：${mutation.what} —— 扫描器没看到这个颜色`).not.toEqual([])
      // 门槛本身在 labContrast.test.ts 里断言；这里只确认颜色与 opacity 被读到
      const [hit] = styled
      expect(hit!.color).toBeTruthy()
      if (mutation.id === 'M8b') expect(hit!.opacity).toBe(0.3)
    },
  )

  it('领域配置对象不算样式 —— 否则会产出"1.04 的低对比文字色"这种假结论', () => {
    const fog = colorLiterals("const f = { color: '#f0ece4', near: 15, far: 60 }", 'm.ts')
    expect(fog.every(h => !h.inStyle)).toBe(true)
  })

  it('自带背景色时按它算 —— 用错背景得到的是看起来很精确的错数字', () => {
    const [hit] = colorLiterals(
      "const s = { color: '#7fe9ff', background: 'rgba(7,11,18,0.88)', padding: 4 }",
      'm.ts',
    )
    expect(hit!.localBackground).toBe('rgba(7,11,18,0.88)')
    expect(LOW_CONTRAST_ON_PAPER).toBe(4.5)
  })
})

// ─────────────────────────────────── 状态机事件的运行时发送方（第四条门禁）

/**
 * `machineEventWiring.test.ts` 的变异形态。
 *
 * 这一组不是当年那 20 个 review 形态，是**接线 `room.machine` 时新写的门禁自己
 * 的变异**（ADR 20260903211338）。放进这份清单的理由与那 20 个相同：一个门禁
 * 能被什么形态绕过，只有写下来才不会在下一次改动里被悄悄放宽。
 */
const EVENT_WIRING_MUTATIONS: readonly Mutation[] = [
  {
    id: 'W1',
    then: 'survived',
    what: '注释里出现事件形状 —— 文本匹配版把注释当成了发送方',
    code: "// old: decideDoorEntry({ type: 'BACK' })\nconst a = 1",
  },
  {
    id: 'W2',
    then: 'survived',
    what: '机器自己的事件联合类型声明 —— 文本匹配版把类型声明也当成发送方',
    code: "type E = { type: 'MOUNTED' } | { type: 'READY' }",
  },
  {
    id: 'W3',
    then: 'killed',
    what: '真的发送方 —— 必须认出来，否则门禁会误报一片',
    code: "tryRoom({ type: 'MOUNTED' })",
  },
]

describe('事件发送方扫描', () => {
  it('W1：注释里的事件形状不算发送方', () => {
    const found = eventTypeLiterals(EVENT_WIRING_MUTATIONS[0]!.code, 'm.ts')
    expect(found, '注释被当成了发送方 —— 4 条 BACK 死边就是这么绿着的').toEqual([])
  })

  it('W2：联合类型声明不算发送方 —— AST 顺带解决的，不是刻意排除的', () => {
    /*
      我原先以为这条要靠"跳过机器定义目录"才能过：声明与发送在源码里都是
      `type: 字面量`。实际不用——类型字面量里那是 `PropertySignature`，
      对象字面量里才是 `PropertyAssignment`，AST 天然分得开。
      文本匹配分不开，所以这条当年（第一版）是存活的。

      门禁那边仍然排除机器定义目录，理由不同：机器内部若自己 `send` 一个事件，
      那不算"运行时有消费方"。
    */
    const found = eventTypeLiterals(EVENT_WIRING_MUTATIONS[1]!.code, 'm.ts')
    expect(found, '类型声明被当成了发送方').toEqual([])
  })

  it('W3：真的发送方认得出来', () => {
    expect(eventTypeLiterals(EVENT_WIRING_MUTATIONS[2]!.code, 'm.ts')).toEqual(['MOUNTED'])
  })

  it('只认全大写 —— 普通的 type 属性不该被当成事件', () => {
    expect(eventTypeLiterals("const p = { type: 'button' }", 'm.ts')).toEqual([])
    expect(eventTypeLiterals("const p = { type: 'Submit' }", 'm.ts')).toEqual([])
  })
})

describe('清单本身', () => {
  it('三组变异都保留了当年存活的形态 —— 清单只能增不能删', () => {
    const all = [
      ...CAMERA_MUTATIONS, ...I18N_MUTATIONS, ...CONTRAST_MUTATIONS,
      ...EVENT_WIRING_MUTATIONS,
    ]
    expect(all.filter(m => m.then === 'survived').length).toBeGreaterThanOrEqual(16)
    for (const m of all) {
      expect(m.what.length, m.id).toBeGreaterThan(10)
      expect(m.code.length, m.id).toBeGreaterThan(5)
    }
  })

  it('编号不重复', () => {
    const ids = [
      ...CAMERA_MUTATIONS, ...I18N_MUTATIONS, ...CONTRAST_MUTATIONS,
      ...EVENT_WIRING_MUTATIONS,
    ].map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
