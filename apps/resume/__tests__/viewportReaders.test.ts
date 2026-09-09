import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { memberCalls, walkSources } from './helpers/sourceScan'

/**
 * 「视口判据的读点收敛」门禁（ADR 20260909182319）。
 *
 * ## 守什么
 *
 * `window.matchMedia` 的调用点只减不增，目标是收归两处：
 * `hooks/useViewport.ts`（窄屏 / 触屏 / 悬停）与 `lib/lab/app/motion.ts`
 * （reduced-motion，已由 `motionConsumers.test.ts` 守着）。
 *
 * ## 为什么必须是棘轮，不能是硬白名单
 *
 * 起草时我本想写「只许两个文件」。AST 实测全站 **9 个文件**真的调用 `matchMedia`，
 * 其中 `lib/animations/scrollReveal.ts` 是**合法的** reduced-motion 读者。
 * 硬白名单第一天就会红，然后被人加豁免或直接删掉
 * ——`.claude/hooks/AGENTS.md` 那句「误报会训练人绕过守卫，那比漏报更危险」
 * 在这里同样适用。
 *
 * ## 为什么值得守
 *
 * `pointer: coarse` 此前在**六个**文件各查一次、各存一份 state
 * （`EntryStage` / `ExplorerBar` / `EntryPreviewScene` / `ArtworkFrame` /
 * `LabScene` / `LabTutorial`）。`hooks/useMotionScale.ts` 的文件头注释逐字写着
 * 这个病：「有人订阅 store、有人调 matchMedia、有人干脆自己存一份，于是同一时刻…」
 * ——reduced-motion 已经因此收归单一入口，触屏与窄屏判据没有做同样的事。
 *
 * 三个维度不许压成一个布尔，理由在 `hooks/useViewport.ts` 的文件头
 * （历史上已有两次回归：只看宽度会让拖窄的桌面窗口掉进静态图路径；
 * 只看 pointer 会让 iPad 横屏掉进去）。
 */

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const

/** 收敛目标 */
const INTENDED = ['hooks/useViewport.ts', 'lib/lab/app/motion.ts'] as const

/**
 * 当前读点：`{ 文件: 调用次数 }`。**数字只能往下**，减到 0 要从表里删。
 *
 * 每一条都要说得出为什么还在读，说不出的就该改成 `useViewport()`。
 */
const KNOWN: Record<string, number> = {
  // ── 收敛目标本身 ──
  'hooks/useViewport.ts': 3,       // 窄 / 触 / 悬停各一条查询
  'lib/lab/app/motion.ts': 1,      // reduced-motion 的单一入口

  // ── 合法的 reduced-motion 读者（与 motion.ts 同一维度，另有门禁守着） ──
  'lib/animations/scrollReveal.ts': 1,
  //
  // 注：`hooks/useMotionScale.ts` **不在这里**。我起草基线时用 grep 数出「10 个文件
  // 读 matchMedia」，把它算进去了——而它那处是**注释里**的提及（正是那句
  // 「有人订阅 store、有人调 matchMedia、有人干脆自己存一份」）。
  // AST 查询只认调用表达式，所以正确地没算它，僵尸检查随即把我的多余条目抓了出来。
  // 这是本仓库门禁一律走 AST 而非正则的现成例证（ADR 20260903211320）。

  // ── 待改成 useViewport() ──
  'app/page.tsx': 2,                            // isStacked + hover&pointer
  'components/ui/GlowButton.tsx': 1,            // (pointer: fine)
  'components/entry/EntryStage.tsx': 1,         // coarse && ≤768（两个条件都要，见 AGENTS.md）
  'components/entry/EntryPreviewScene.tsx': 1,
  'components/lab/LabScene.tsx': 1,
  'components/lab/LabTutorial.tsx': 1,
}

describe('视口判据的读点收敛', () => {
  const readers = new Map<string, number>()
  for (const dir of SCAN_DIRS) {
    for (const file of walkSources(join(ROOT, dir))) {
      const rel = relative(ROOT, file)
      const hits = memberCalls(readFileSync(file, 'utf8'), 'window', 'matchMedia', rel)
      if (hits.length > 0) readers.set(rel, hits.length)
    }
  }

  it('没有新增的 matchMedia 读点，已有的也没变多', () => {
    const problems: string[] = []
    for (const [file, count] of readers) {
      const allowed = KNOWN[file]
      if (allowed === undefined) problems.push(`${file}（${count} 处，未登记）`)
      else if (count > allowed) problems.push(`${file}（${count} 处 > 基线 ${allowed}）`)
    }
    expect(
      problems,
      '要读视口形态请用 hooks/useViewport.ts，不要自己调 matchMedia。\n'
      + problems.join('\n'),
    ).toEqual([])
  })

  it('收敛目标确实在读（防止判据退化成永远为空）', () => {
    for (const f of INTENDED) {
      expect(readers.get(f) ?? 0, `${f} 应当是读点之一`).toBeGreaterThan(0)
    }
  })

  it('基线里没有僵尸条目', () => {
    const zombies = Object.keys(KNOWN).filter(f => !readers.has(f))
    expect(
      zombies,
      '这些文件已不再调 matchMedia，请从 KNOWN 里删掉：\n' + zombies.join('\n'),
    ).toEqual([])
  })
})
