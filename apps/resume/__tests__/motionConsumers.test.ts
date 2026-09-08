import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { importsModule, walkSources } from './helpers/sourceScan'

/**
 * 「持续动画必须读动效开关」门禁（ADR 20260908172231）。
 *
 * ## 守什么
 *
 * Lab 是全站动效最密的地方，而它在 2026-09-08 之前**完全不响应
 * `prefers-reduced-motion`** —— 全仓 5 处命中全在 Classic 与加载指示器。对前庭
 * 功能敏感的访客，这一页是"进去就晃"。
 *
 * 判据取「`useFrame` + 读时钟」：**由时间驱动**的动画就是自发运动，必须能被
 * 关掉。由用户动作驱动的（相机距离触发的侧身、hover 上色、点击反馈）不在此列
 * —— 关掉它们等于把交互也关掉。
 *
 * ## 为什么用棘轮而不是全禁
 *
 * 走廊层（`components/lab/`）已经全部接上，所以那一组是**零例外**。
 * 房间层（`components/rooms/`）还有一批没接（云、桶、纸、灯的呼吸…），
 * 那是后续几期的事。把它们**逐个列出来**而不是整个目录豁免：
 *
 * - 新增一个不读开关的房间动画 → 门禁红（因为它不在清单里）
 * - 接好一个就要把它从清单里删掉 → 清单只能变短
 *
 * 文件级"整目录豁免"的漏洞正是相机写点棘轮当年吃过的教训：已在名单里的文件
 * 再加 20 个写点也是绿的。
 */

const ROOT = join(__dirname, '..')
const STORE_MODULE = '@/lib/lab/app/stores/corridorStore'

/**
 * 房间层尚未接入动效开关的文件。
 *
 * **只能减，不能增。** 每接好一个就从这里删掉一行；新增的房间动画一开始就该
 * 读开关，不要往这张表里加。
 */
const ROOM_LEVEL_PENDING: readonly string[] = [
  'components/rooms/AboutRoom.tsx',
  'components/rooms/ContactRoom.tsx',
  'components/rooms/about/SkyChunk.tsx',
  'components/rooms/contact/MessagePaper.tsx',
  'components/rooms/contact/SocialBarrel.tsx',
  'components/rooms/gallery/GalleryClouds.tsx',
  'components/rooms/gallery/PaperMaterial.tsx',
  'components/rooms/projects/LabFurniture.tsx',
  'components/rooms/publications/PublicationCard.tsx',
]

/** 由时间驱动（= 自发运动）的文件 */
function timeDrivenFiles(dir: string): string[] {
  const out: string[] = []
  for (const file of walkSources(join(ROOT, dir))) {
    const source = readFileSync(file, 'utf8')
    const usesFrame = source.includes('useFrame')
    const readsClock = source.includes('clock.elapsedTime') || source.includes('clock.getElapsedTime')
    if (usesFrame && readsClock) out.push(relative(ROOT, file))
  }
  return out.sort()
}

function guarded(file: string): boolean {
  return importsModule(readFileSync(join(ROOT, file), 'utf8'), STORE_MODULE, file)
}

describe('持续动画必须读动效开关', () => {
  it('走廊层零例外：每个时间驱动的组件都读 motionScale', () => {
    const unguarded = timeDrivenFiles('components/lab').filter(file => !guarded(file))
    expect(
      unguarded,
      '这些走廊组件由时间驱动却读不到动效开关，`prefers-reduced-motion` 对它们无效。\n' +
        `修法：import { useCorridorStore } from '${STORE_MODULE}'，` +
        '取 `state.motionScale`，为 0 时停在基准姿态（不是停在当前姿态——' +
        '停在半空中的东西看起来像加载失败）。\n' +
        `未接开关：\n  ${unguarded.join('\n  ')}`,
    ).toEqual([])
  })

  it('走廊层确实有时间驱动的组件（门禁不能因为判据失效而空跑）', () => {
    /*
      若判据（`useFrame` + 读时钟）因为某次重构不再匹配任何文件，上面那条会
      "全绿"——而那是最坏的情况：门禁在，但什么都没检查。
    */
    expect(timeDrivenFiles('components/lab').length).toBeGreaterThanOrEqual(3)
  })

  it('房间层的未接清单与实际一致（只能变短）', () => {
    const unguarded = timeDrivenFiles('components/rooms').filter(file => !guarded(file))
    expect(
      unguarded,
      '房间层未接动效开关的文件与清单不一致。\n' +
        '· 多出来的：新增的房间动画请一开始就读 motionScale，不要往清单里加。\n' +
        '· 少了的：接好一个就把它从 ROOM_LEVEL_PENDING 里删掉（清单只能变短）。',
    ).toEqual([...ROOM_LEVEL_PENDING].sort())
  })

  it('清单里的每个文件都真实存在（防僵尸豁免）', () => {
    for (const file of ROOM_LEVEL_PENDING) {
      expect(() => readFileSync(join(ROOT, file), 'utf8'), `${file} 不存在`).not.toThrow()
    }
  })
})
