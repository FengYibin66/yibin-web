import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTexture } from '@react-three/drei'

import { getCorridorMuralTexturePaths } from '@/lib/lab/corridorMurals'
import { ROOM_IDS } from '@/lib/lab/domain/ids'
import { ROOMS } from '@/lib/lab/domain/rooms'

vi.mock('@react-three/drei', () => ({
  useTexture: {
    clear: vi.fn(),
    preload: vi.fn(),
  },
}))

const {
  CORRIDOR_TEXTURES,
  FIRST_SCREEN_MURAL_SEGMENTS,
  ROOM_ASSETS,
} = await import('@/lib/lab/app/assets/manifest.gen')
const {
  preloadCorridorTextures,
  preloadRoomAssets,
  reloadRoomAssets,
  resetPreloadState,
} = await import('@/lib/lab/app/assets/preload')

/**
 * 纹理预载 —— 现在读的是**派生的**清单（ADR 20260903140615）。
 *
 * ## 这个文件取代了什么
 *
 * 原先是 `__tests__/roomAssets.test.ts`，测的是**手写表** `lib/lab/roomAssets.ts`。
 * 那份手写表已删除：生成物 `manifest.gen.ts` 早就存在（CI 也在跑它的 `--check`），
 * 但**唯一引用它的是生成它的脚本自己**——运行时从来读的是手写表。
 *
 * 两份表因此漂移，而漂移不报错：
 *
 * - 注册表声明 Projects 有 18 张纹理，手写表 15 张
 * - 手写表的首屏壁画是 3 段（16 张），生成物写的是 1 段
 *   ——**审计 G1（首屏 7.6MB）的修法一直没生效**
 *
 * 旧文件里那份 19 条硬编码的 `PUBLICATION_TEXTURES` 清单也随之删掉：那是把生成物
 * 的内容抄了第二遍，抄出来的第二份迟早与本体不一致——而它守的"publications 收录
 * 完整场景"这件事，现在由「注册表 ⊆ 生成物」那条断言覆盖，且不需要维护清单。
 */

describe('派生清单与注册表一致', () => {
  it('每个房间在生成物里都有条目', () => {
    for (const roomId of ROOM_IDS) {
      expect(ROOM_ASSETS[roomId], `${roomId} 不在生成物里`).toBeDefined()
    }
  })

  it('注册表声明的资源全部出现在生成物里 —— 漏一张就是某个物件没贴图', () => {
    /*
      方向很重要：断言的是「注册表 ⊆ 生成物」。反过来（生成物 ⊆ 注册表）不成立，
      因为生成器还会扫组件里的字面量——那是刻意的，模板字面量与数据驱动的路径
      静态扫描抓不到，漏它们的表现不是报错而是"某个物件突然没贴图"。
    */
    const missing: string[] = []
    for (const roomId of ROOM_IDS) {
      const generated = new Set(ROOM_ASSETS[roomId] ?? [])
      for (const asset of ROOMS[roomId].assets) {
        if (!generated.has(asset)) missing.push(`${roomId}: ${asset}`)
      }
    }
    expect(
      missing,
      '这些资源在注册表里声明了但生成物里没有，跑 node scripts/lab/gen-asset-manifest.mjs：\n'
      + missing.join('\n'),
    ).toEqual([])
  })

  it('gallery 的清单是空的 —— 它走独立路由，不需要特例分支', () => {
    /*
      注册表里 `gallery.assets` 是 `[]`，所以运行时不需要
      `if (roomId === 'gallery')`。这条断言把"特例消失"这件事钉住：
      哪天有人给 gallery 加了 assets，预载会把它们塞进 Lab 的首屏而没人注意。
    */
    expect(ROOMS.gallery.assets).toEqual([])
    expect(ROOM_ASSETS.gallery ?? []).toEqual([])
  })

  it('首屏只载一段壁画 —— 这是审计 G1（7.6MB 首屏）的修法', () => {
    expect(FIRST_SCREEN_MURAL_SEGMENTS).toBe(1)
  })

  it('走廊清单里的壁画不超过一段的量', () => {
    /*
      手写表那份是 3 段共 16 张。这条断言的意义是：运行时读的清单确实是"1 段"
      那一份，而不是某天有人又把手写表接回来。
    */
    const murals = CORRIDOR_TEXTURES.filter(p => p.includes('/murals/'))
    expect(
      murals.length,
      `走廊首屏有 ${murals.length} 张壁画，一段应该只有几张——` +
      '像是又读到了手写表那份 3 段的清单',
    ).toBeLessThanOrEqual(8)
  })
})

describe('首屏预算', () => {
  /*
    ── 换成生成物省了多少、还剩多少 ────────────────────────────────────────

    实测（`public/` 下的真实文件大小）：

    | 清单 | 张数 | 大小 |
    |------|------|------|
    | 生成物（1 段壁画） | 60 | 8826 KB |
    | 手写表（3 段壁画） | 64 | 10292 KB |

    也就是说接线本身省下 **1466 KB**。但更重要的是它暴露了 G1 剩下的真正重量：
    8826 KB 里有 **6339 KB 是单段壁画的 12 张图**（平均每张 528 KB）。那些是
    相册照片被当成走廊墙面装饰用，从未经过 `optimize-textures` 那条流水线
    （它只处理入口页）。

    所以 G1 只算**部分**解决：段数从 3 降到 1，而剩下的一段仍然是首屏的绝对大头。
    要继续降只有两条路，都带视觉决定，不在接线这一批里：
      1. 把壁画也纳入重编码流水线（按墙面显示尺寸降采样）
      2. 首屏完全不载壁画，等 idle 再取（代价是刚进走廊时墙面空白）

    下面这两条断言的作用是**锁住现状不再涨**，并且让"还有 6.3MB"这件事在测试里
    有据可查，而不是只写在某个 PR 描述里。
  */
  const ROOT = join(import.meta.dirname, '..')

  function totalKb(paths: readonly string[]): number {
    let kb = 0
    for (const p of paths) {
      const file = join(ROOT, 'public', p.replace(/^\//, ''))
      if (existsSync(file)) kb += statSync(file).size / 1024
    }
    return Math.round(kb)
  }

  it('走廊首屏总量不超过预算', () => {
    const kb = totalKb(CORRIDOR_TEXTURES)
    expect(
      kb,
      `走廊首屏 ${kb} KB，超了预算。要么继续瘦身，要么先解释为什么值得抬这条线`,
    ).toBeLessThan(9500)
  })

  it('比手写表那份（3 段壁画）确实小 —— 接线的收益是可量的', () => {
    const generated = totalKb(CORRIDOR_TEXTURES)
    const threeSegments = totalKb([
      ...CORRIDOR_TEXTURES,
      ...getCorridorMuralTexturePaths(3).filter(p => !CORRIDOR_TEXTURES.includes(p)),
    ])
    expect(
      threeSegments - generated,
      '与 3 段壁画那份一样大，像是又读回了手写表',
    ).toBeGreaterThan(1000)
  })
})

describe('preloadRoomAssets', () => {
  beforeEach(() => {
    vi.mocked(useTexture.preload).mockClear()
    vi.mocked(useTexture.clear).mockClear()
    resetPreloadState()
  })

  it('逐个预载房间清单，同一房间只执行一次', () => {
    preloadRoomAssets('about')
    const first = vi.mocked(useTexture.preload).mock.calls.length
    expect(first).toBe(ROOM_ASSETS.about!.length)

    preloadRoomAssets('about')
    expect(
      vi.mocked(useTexture.preload).mock.calls.length,
      '重复调用又预载了一遍 —— 每次靠近门都会调，这会变成持续的重复请求',
    ).toBe(first)
  })

  it('reload 先 clear 再重新预载 —— 不 clear 的话重试会拿到同一个失败的 promise', () => {
    preloadRoomAssets('projects')
    vi.mocked(useTexture.preload).mockClear()

    reloadRoomAssets('projects')

    expect(vi.mocked(useTexture.clear).mock.calls.length)
      .toBe(ROOM_ASSETS.projects!.length)
    expect(
      vi.mocked(useTexture.preload).mock.calls.length,
      'clear 之后没有重新预载，表现是"点了重试没反应"',
    ).toBe(ROOM_ASSETS.projects!.length)
  })

  it('gallery 不炸 —— 空清单是合法的', () => {
    expect(() => preloadRoomAssets('gallery')).not.toThrow()
    expect(vi.mocked(useTexture.preload)).not.toHaveBeenCalled()
  })

  it('只预载纹理，不把音频塞进 useTexture', () => {
    /*
      手写表里曾有一个 `PUBLICATION_AUDIO_ASSETS`，而音频走 `AudioMixer`
      而不是纹理加载器。生成物把声音单独放在 `SOUND_FILES` 里，所以这条断言
      现在是"房间清单里没有音频后缀"。
    */
    for (const roomId of ROOM_IDS) {
      for (const asset of ROOM_ASSETS[roomId] ?? []) {
        expect(asset, `${roomId} 的纹理清单里混进了音频：${asset}`)
          .not.toMatch(/\.(mp3|m4a|ogg|wav)$/)
      }
    }
  })
})

describe('preloadCorridorTextures', () => {
  beforeEach(() => {
    vi.mocked(useTexture.preload).mockClear()
  })

  it('预载走廊首屏的每一张', () => {
    preloadCorridorTextures()
    expect(vi.mocked(useTexture.preload).mock.calls.length).toBe(CORRIDOR_TEXTURES.length)
  })

  it('清单非空 —— 空了的话走廊是一片白而且不报错', () => {
    expect(CORRIDOR_TEXTURES.length).toBeGreaterThan(20)
  })
})
