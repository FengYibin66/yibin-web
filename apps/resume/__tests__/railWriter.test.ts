import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { functionCalls, walkSources } from './helpers/sourceScan'

/**
 * 「导轨状态只有一个写者」门禁（ADR 20260908172231）。
 *
 * ## 守什么
 *
 * 走廊的世界状态（相机在导轨上的位置与速度）由 `setRail` 发布，而
 * **只有 `hooks/useCorridorCamera.ts` 能调它** —— 它已经是走廊侧的相机持有者，
 * 导轨状态本来就归它。
 *
 * ## 为什么必须是机制而不是约定
 *
 * 两个写者会让"玩家在哪、多快"出现两个答案。这类 bug 的表现不是报错，而是
 * "活物偶尔跑到墙里""脚步声偶尔在静止时响"这种无法复现的怪事——因为哪个写者
 * 后写完全取决于 `useFrame` 的注册顺序，而注册顺序取决于组件挂载顺序。
 *
 * 同样形态的教训在这个仓库里发生过两次：相机被多处写（ADR 20260903140617 收归
 * 单一导演，写点棘轮 8 文件 / 34 写点）、`ScrollTrigger` 被多处 kill（ADR
 * 20260907120701 全禁 `getAll()`）。两次都是"约定"没守住、加了机制才停下来。
 *
 * ## 无棘轮
 *
 * 与相机写点那条不同，这里**不留白名单**：`setRail` 是这次新加的 API，没有
 * 历史包袱，一开始就该是零例外。要加第二个写者就得先改这条门禁——那正是
 * 我们希望发生的事（改门禁会被 review 看到，加一行 `setRail(...)` 不会）。
 */

const ROOT = join(__dirname, '..')

/** 唯一允许调用 `setRail` 的文件（相对 `apps/resume`） */
const SOLE_WRITER = 'hooks/useCorridorCamera.ts'

/** `setRail` 的定义所在。**不是豁免** —— 见下方那条断言 */
const IMPLEMENTATION = 'lib/lab/app/stores/corridorStore.ts'

const SCAN_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const

describe('导轨状态只有一个写者', () => {
  const callers = new Map<string, number>()
  for (const dir of SCAN_DIRS) {
    for (const file of walkSources(join(ROOT, dir))) {
      const rel = relative(ROOT, file)
      const hits = functionCalls(readFileSync(file, 'utf8'), 'setRail', rel)
      if (hits.length > 0) callers.set(rel, hits.length)
    }
  }

  /*
    `setRail` 的定义所在文件**不该出现在调用者名单里** —— `functionCalls` 只认
    调用表达式，`export function setRail(...)` 是声明。

    这一条替代了"给实现文件开一个豁免"的写法：那种豁免永远不会被用到，就成了
    僵尸豁免，而僵尸豁免的问题是它掩盖了判据的真实行为（下一个人会以为扫描器
    连定义一起抓，于是照此推理）。`textureBudget.test.ts` 里"豁免名单里的项必须
    真实存在"守的是同一件事。
  */
  it('定义不算调用：store 文件不在调用者名单里', () => {
    expect(callers.has(IMPLEMENTATION)).toBe(false)
  })

  it('只有 useCorridorCamera 调 setRail', () => {
    const unexpected = [...callers.keys()].filter(file => file !== SOLE_WRITER).sort()
    expect(
      unexpected,
      '导轨状态出现了第二个写者。它会让"玩家在哪、多快"有两个答案，' +
        '而哪个生效取决于 useFrame 的注册顺序（= 组件挂载顺序）。\n' +
        '要发布导轨状态请改 hooks/useCorridorCamera.ts；' +
        '要读取请用 getRail() / getWorld()。\n' +
        `越界文件：\n  ${unexpected.join('\n  ')}`,
    ).toEqual([])
  })

  it('唯一写者确实在调它（门禁不能因为改名而静默失效）', () => {
    expect(
      callers.get(SOLE_WRITER),
      `${SOLE_WRITER} 里没有 setRail 调用。要么导轨不再发布状态（那么世界状态是空的、` +
        '所有消费者都读到 0），要么这条门禁的函数名过期了。两种都要人来看。',
    ).toBeGreaterThan(0)
  })

  /*
    这条门禁只限制**写**。读取（`getRail` / `getWorld` / `useCorridorStore`）
    对任何组件开放，所以没有对应的断言 —— "某件事被允许"没有可断言的内容。
  */
})
