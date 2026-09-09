import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { memberCalls, walkSources } from './helpers/sourceScan'

/**
 * 「视口判据的读点收敛」门禁（ADR 20260909182319）。
 *
 * `window.matchMedia` 的调用点只减不增，目标是收归 `hooks/useViewport.ts`
 * 与 `lib/lab/app/motion.ts`（reduced-motion）。
 *
 * 棘轮而非硬白名单：AST 实测有 9 个文件真的在调，其中 `lib/animations/scrollReveal.ts`
 * 是**合法的** reduced-motion 读者。硬白名单第一天就红，然后会被加豁免或删掉
 * （`.claude/hooks/AGENTS.md`：误报比漏报更危险）。
 */

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const

/** 收敛目标 */
const INTENDED = ['hooks/useViewport.ts', 'lib/lab/app/motion.ts'] as const

/** 当前读点。**数字只能往下**，减到 0 要从表里删 */
const KNOWN: Record<string, number> = {
  'hooks/useViewport.ts': 3,       // 窄 / 触 / 悬停各一条查询
  'lib/lab/app/motion.ts': 1,      // reduced-motion 的单一入口

  // 合法的 reduced-motion 读者（另有 motionConsumers.test.ts 守着）
  'lib/animations/scrollReveal.ts': 1,

  // 待改成 useViewport()
  'app/page.tsx': 2,                            // isStacked + hover&pointer
  'components/ui/GlowButton.tsx': 1,            // (pointer: fine)
  'components/entry/EntryStage.tsx': 1,         // coarse && ≤768，两个条件都要
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
