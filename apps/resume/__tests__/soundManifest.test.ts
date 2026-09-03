import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SOUND_MANIFEST, type SoundName } from '@/lib/lab/domain/audio/manifest'

/**
 * 音频清单的存在性与格式兜底门禁。
 *
 * 两个真实故障（审计 B2 / C1）：
 *
 * - `SOUND_PATHS.paper_tear` 指向 `/sounds/paper_tear.mp3`，而真实文件叫
 *   `papersound.mp3`。于是每次传送两次 404，纸撕声从未响过；`achievement.mp3`
 *   同样不存在。实机 Playwright 复现过这两条 404。
 * - `bg_corridor` 只有 `.ogg` 一种格式。**WebKit 不支持 OGG Vorbis**，
 *   于是走廊 BGM 在所有 Safari 与全部 iOS 浏览器完全静音。
 *
 * 两条都属于"不会报错、只会没声音"的缺陷。清单与磁盘的一致性必须是断言。
 */

const PUBLIC_ROOT = join(__dirname, '../public')

/** WebKit（Safari / 全部 iOS 浏览器）无法解码的容器 */
const WEBKIT_UNSUPPORTED = ['.ogg', '.opus', '.webm']

describe('SOUND_MANIFEST', () => {
  const entries = Object.entries(SOUND_MANIFEST) as [SoundName, { src: readonly string[] }][]

  it('不是空清单 —— 防止测试在清单被清空后变成空跑', () => {
    expect(entries.length).toBeGreaterThanOrEqual(5)
  })

  it.each(entries)('%s 的每个候选文件都存在于 public/', (name, def) => {
    expect(def.src.length, `${name} 没有任何候选源`).toBeGreaterThan(0)
    for (const src of def.src) {
      expect(src.startsWith('/'), `${name} 的 "${src}" 不是绝对路径`).toBe(true)
      expect(
        existsSync(join(PUBLIC_ROOT, src)),
        `${name} 引用了不存在的文件：public${src}`,
      ).toBe(true)
    }
  })

  it.each(entries)('%s 至少有一个 WebKit 能解码的格式', (name, def) => {
    const playableOnWebkit = def.src.filter(
      (src) => !WEBKIT_UNSUPPORTED.some((ext) => src.toLowerCase().endsWith(ext)),
    )
    expect(
      playableOnWebkit.length,
      `${name} 只提供了 ${def.src.join(', ')}，Safari / iOS 会完全静音`,
    ).toBeGreaterThan(0)
  })
})
