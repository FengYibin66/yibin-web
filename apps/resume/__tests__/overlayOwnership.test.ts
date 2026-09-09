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
 * 把元素钉在视口上（`position: fixed | sticky`，含 Tailwind 的 `fixed` / `sticky`）
 * 的权限收归 `components/layout/EdgeLayer.tsx`；其余文件要占屏角先在
 * `lib/layout/overlays.ts` 登记，再用 `<EdgeItem>`。
 *
 * 棘轮，形态同 `cameraOwnership.test.ts`：**数字只能往下**，减到 0 要从表里删。
 */

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const

/** 唯一有权写 fixed / sticky 的文件 */
const SOLE_WRITER = 'components/layout/EdgeLayer.tsx'

/** 尚未收编的写点。每一条都要说得出为什么还在这儿 */
const KNOWN: Record<string, number> = {
  // 全屏覆盖层 / 模态 / 灯箱：语义是「盖住一切」而非「占一个角」，
  // ADR 划为第二期不做（重新定序会让画面出错，而 z 序没有任何断言守着）
  'components/lab/LabLoader.tsx': 1,
  'components/lab/PaperTransition.tsx': 1,
  'components/lab/LabTutorial.tsx': 1,
  'components/gallery/GalleryLightbox.tsx': 1,
  'components/rooms/contact/MessagePaper.tsx': 1,
  'components/ui/ImagePreview.tsx': 1,
  // 收编后只剩那个 `inset: 0` 容器（承载 data-lab-*、路线字幕与三个面板）
  'components/ui/NavigationUI.tsx': 1,

  // 待收编
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
    // 判据静默失效的症状是「什么都扫不到」，那会让上面那条永远绿
    expect(writers.get(SOLE_WRITER) ?? 0).toBeGreaterThan(0)
  })

  it('基线里没有僵尸条目（已收编的文件要从表里删掉）', () => {
    const zombies = Object.keys(KNOWN).filter(f => !writers.has(f))
    expect(
      zombies,
      '这些文件已经不再写 fixed / sticky，请从 KNOWN 里删掉：\n' + zombies.join('\n'),
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
    // ADR 20260903211338。判据：源码里出现 `id="<id>"` 或 `id='<id>'`
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
    /** 只列真正互斥的——多列一对就是给自己开豁免 */
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
          // 不同页面的两个挂件不会同时在场，判成冲突是误报
          if (a.surface !== b.surface) continue
          if (!isExclusive(a.presence, b.presence) && a.order === b.order) {
            problems.push(`${slot}：${a.id} 与 ${b.id} 同 order=${a.order} 且不互斥`)
          }
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('每条挂件的 surface 与 presence 都是声明过的取值', () => {
    // EXCLUSIVE_PAIRS 里列一对表里没人用的组合会让判据静默变宽松，且没有症状
    const used = new Set(OVERLAY_REGISTRY.map(e => e.presence))
    for (const pres of ['in-room', 'not-in-room'] as const) {
      expect(used.has(pres), `EXCLUSIVE_PAIRS 里列了 ${pres}，但注册表里没人用它`).toBe(true)
    }
    expect(new Set(OVERLAY_REGISTRY.map(e => e.surface))).toEqual(new Set(['entry', 'lab']))
  })

  it('层序的 z 由下标派生且严格递增（不手写数字的保证）', () => {
    const zs = OVERLAY_LAYERS.map(zOfLayer)
    expect(zs).toEqual([...zs].sort((a, b) => a - b))
    expect(new Set(zs).size).toBe(zs.length)
  })
})
