import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fixedPositions, walkSources } from './helpers/sourceScan'
import {
  EDGE_SLOTS,
  OVERLAY_LAYERS,
  OVERLAY_REGISTRY,
  overlaysInSlot,
  zOfLayer,
  type EdgeSlot,
  type OverlayPresence,
} from '@/lib/layout/overlays'

/**
 * 「屏幕的四个角只有一个写者」门禁（ADR 20260909182319）。
 *
 * ## 守什么
 *
 * 把元素钉在视口上（`position: fixed | sticky`、Tailwind 的 `fixed` / `sticky`）
 * 的权限收归 `components/layout/EdgeLayer.tsx`。其余文件想占一个屏角，要在
 * `lib/layout/overlays.ts` 登记，然后用 `<EdgeItem>`。
 *
 * ## 为什么必须是机制
 *
 * 此前全站 15 处 `position: fixed` 各自写坐标与 z 值（15 个互不共享的数）。
 * 撞不撞取决于内容宽度，所以桌面上"刚好不撞"纯属侥幸。2026-09-09 审计实测出
 * 四个真实重叠，其中一个**在桌面上**（入口页域名水印被底部提示 100% 盖住，
 * 从那条提示上线那天起没人见过）。
 *
 * 而这个仓库已经为同一个抽象缺失付过一次钱：`globals.css` 里
 * `.achievement-popup { bottom: 88px }` 的注释写着
 * `88 = 32（提示的底距）+ 提示自身高度（约 20）+ 一段间距`
 * ——一个组件手算另一个组件的高度。手算的数在被算的那个组件改一行字时就悄悄错了，
 * 而没有任何东西会报警。
 *
 * ## 棘轮，且只能往下
 *
 * 与相机写点那条同形（`cameraOwnership.test.ts`，8 文件 / 34 写点）。
 * ADR 把收编分两期，**第二期（Lab 的四个全屏层）明确不做**——它们的语义是
 * 「盖住一切」而不是「占一个角」，重新定序有真实风险，而 `lab.spec.ts` 那 61 条
 * 断言读的是 `data-lab-*` 属性、对 z 序完全失明，改错了没有任何测试会红。
 *
 * 所以基线里留着它们。**数字只能减少**：减到 0 的条目要从表里删掉（见最后一条
 * 断言），否则会留下僵尸豁免——而僵尸豁免掩盖判据的真实行为，
 * 下一个人会照着它错误地推理。
 */

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const

/** 唯一有权写 fixed / sticky 的文件 */
const SOLE_WRITER = 'components/layout/EdgeLayer.tsx'

/**
 * 尚未收编的写点：`{ 文件: 当前写点数 }`。
 *
 * 每一条都要说得出为什么还在这儿——说不出的就该收编，而不是留在表里。
 */
const KNOWN: Record<string, number> = {
  // ── ADR 划为「第二期，不做」的全屏覆盖层 ──
  // 语义是「盖住一切」，不占某个角；重新定序会让画面出错而测试不会红。
  'components/lab/LabLoader.tsx': 1,
  'components/lab/PaperTransition.tsx': 1,
  'components/lab/LabTutorial.tsx': 1,
  // 收编后只剩这一个 `inset: 0` 容器（它承载 E2E 读的 data-lab-* 属性、
  // 路线字幕与三个面板）。原先是 3：还有右上那排图标与房间内返回按钮。
  'components/ui/NavigationUI.tsx': 1,
  // 同类：全屏模态 / 灯箱。它们盖住整屏、不占某个角，也不与屏角挂件争位置。
  // （这三个是本门禁第一次运行时替我找出来的——我起草基线时漏了它们，
  //   而漏了不会有任何症状，只会让门禁少守三处。）
  'components/gallery/GalleryLightbox.tsx': 1,
  'components/rooms/contact/MessagePaper.tsx': 1,
  'components/ui/ImagePreview.tsx': 1,

  // ── 其余待收编 ──
  'components/layout/Navbar.tsx': 1,
  'components/gallery/GalleryBackButton.tsx': 1,
  'components/gallery/GalleryTrack.tsx': 1,
}

describe('屏幕边缘只有一个 fixed 写者', () => {
  const writers = new Map<string, number>()
  for (const dir of SCAN_DIRS) {
    for (const file of walkSources(join(ROOT, dir))) {
      const rel = relative(ROOT, file)
      const hits = fixedPositions(readFileSync(file, 'utf8'), rel)
      if (hits.length > 0) writers.set(rel, hits.length)
    }
  }

  it('除唯一写者与已登记的历史写点外，没有别的文件把元素钉在视口上', () => {
    const unexpected: string[] = []
    for (const [file, count] of writers) {
      if (file === SOLE_WRITER) continue
      const allowed = KNOWN[file]
      if (allowed === undefined) {
        unexpected.push(`${file}（${count} 处，未登记）`)
      } else if (count > allowed) {
        unexpected.push(`${file}（${count} 处 > 基线 ${allowed}）`)
      }
    }
    expect(
      unexpected,
      '新增屏角挂件要在 lib/layout/overlays.ts 登记并用 <EdgeItem>，'
      + `不要自己写 position: fixed。唯一写者是 ${SOLE_WRITER}。\n`
      + unexpected.join('\n'),
    ).toEqual([])
  })

  it('唯一写者确实在写（防止判据退化成永远为空）', () => {
    // 判据静默失效（选择器写错、AST 查询改坏）的症状是「什么都扫不到」，
    // 而那会让上面那条断言永远绿。这一条是那种失效的唯一症状。
    expect(writers.get(SOLE_WRITER) ?? 0).toBeGreaterThan(0)
  })

  it('基线里没有僵尸条目（已收编的文件要从表里删掉）', () => {
    const zombies = Object.keys(KNOWN).filter(f => !writers.has(f))
    expect(
      zombies,
      '这些文件已经不再写 fixed / sticky，请从 KNOWN 里删掉——'
      + '留着会掩盖判据的真实行为，下一个人会照着它错误地推理：\n'
      + zombies.join('\n'),
    ).toEqual([])
  })
})

describe('屏角声明表自身自洽', () => {
  it('每条注册项的 slot 与 layer 都是声明过的', () => {
    for (const e of OVERLAY_REGISTRY) {
      expect(Object.keys(EDGE_SLOTS), `${e.id} 的 slot`).toContain(e.slot)
      expect(OVERLAY_LAYERS as readonly string[], `${e.id} 的 layer`).toContain(e.layer)
    }
  })

  it('id 不重复（id 同时是 DOM 上的 data-overlay，重复会让 E2E 定位到两个）', () => {
    const ids = OVERLAY_REGISTRY.map(e => e.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it('每条注册项都有真实消费者——「已定义未接线」在本仓库是债务', () => {
    // ADR 20260903211338。判据：源码里出现 `id="<id>"` 或 `id='<id>'`。
    const sources = SCAN_DIRS.flatMap(d => walkSources(join(ROOT, d)))
      .map(f => readFileSync(f, 'utf8'))
      .join('\n')
    const orphans = OVERLAY_REGISTRY
      .filter(e => !sources.includes(`id="${e.id}"`) && !sources.includes(`id='${e.id}'`))
      .map(e => e.id)
    expect(
      orphans,
      '这些浮层登记了但没有任何 <EdgeItem> 用它：\n' + orphans.join('\n'),
    ).toEqual([])
  })

  it('同一槽位的多个占位者必须可证互斥，或次序不冲突', () => {
    /*
      这一条是这张表存在的核心价值。

      同槽位合法地被多个挂件共用（Lab 走廊的 `← Exit Lab` 与房间内的返回按钮
      都在 top-left，靠 isInRoom 互斥），但那个约定今天只活在两个 JSX 条件里。
      声明出来才能断言。

      判据：同槽位的占位者要么 presence 互斥（desktop ↔ narrow），
      要么 order 互不相同（那样它们是并排的 flex 兄弟，不会重叠）。
    */
    /** 可证互斥的 presence 对。**只列真正互斥的**——多列一对就是给自己开豁免 */
    const EXCLUSIVE_PAIRS: readonly (readonly [OverlayPresence, OverlayPresence])[] = [
      ['desktop', 'narrow'],
      ['in-room', 'not-in-room'],
    ]
    const isExclusive = (a: OverlayPresence, b: OverlayPresence) =>
      EXCLUSIVE_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x))

    const problems: string[] = []
    for (const slot of Object.keys(EDGE_SLOTS) as EdgeSlot[]) {
      const items = overlaysInSlot(slot)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]!, b = items[j]!
          /*
            不同页面的两个挂件永远不会同时在场，不构成冲突。

            这一条不是为了让门禁闭嘴：入口页的底部提示与 Lab 走廊的滚动提示
            都是 bottom-center / order 10，判成冲突是**误报**。而误报的下场是
            被人加豁免或删掉判据（`.claude/hooks/AGENTS.md`：
            「误报会训练人绕过守卫，那比漏报更危险」）。
            所以 surface 是注册表的必填字段，不是分类标签。
          */
          if (a.surface !== b.surface) continue
          const exclusive = isExclusive(a.presence, b.presence)
          if (!exclusive && a.order === b.order) {
            problems.push(`${slot}：${a.id} 与 ${b.id} 同 order=${a.order} 且不互斥`)
          }
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('每条挂件的 surface 与 presence 都是声明过的取值', () => {
    // 拼错一个 presence 字符串会让「互斥」判定静默失效——TypeScript 挡得住
    // 字面量，但挡不住 EXCLUSIVE_PAIRS 里列了一对**表里根本没人用**的组合：
    // 那种情况下判据看起来更宽松，而没有任何症状。
    const used = new Set(OVERLAY_REGISTRY.map(e => e.presence))
    for (const pres of ['in-room', 'not-in-room'] as const) {
      expect(used.has(pres), `EXCLUSIVE_PAIRS 里列了 ${pres}，但注册表里没有任何挂件用它`)
        .toBe(true)
    }
    expect(new Set(OVERLAY_REGISTRY.map(e => e.surface))).toEqual(new Set(['entry', 'lab']))
  })

  it('层序的 z 由下标派生且严格递增（不手写数字的保证）', () => {
    const zs = OVERLAY_LAYERS.map(zOfLayer)
    expect(zs).toEqual([...zs].sort((a, b) => a - b))
    expect(new Set(zs).size).toBe(zs.length)
  })
})
