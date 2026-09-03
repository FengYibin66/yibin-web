import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { digestOf, readStamp } from '../scripts/media/freshness.mjs'

/**
 * 四条素材流水线的产物是不是最新的。
 *
 * ## 为什么单独一个文件
 *
 * 这一条以前散在 `galleryDoor` / `fontSubset` / `textureBudget` 三个文件里，
 * 各自比 `mtime`（"产物比源新"）。那在本地成立、**在 CI 上必然失败**——
 * git 不保存 mtime，新克隆里所有文件的 mtime 都是签出那一刻，先后顺序取决于
 * checkout 的写入顺序。CI 第一次跑就红在这上面（`校验音频重编码产物`）。
 *
 * 换成内容指纹之后，这三处的断言变成同一件事，所以合到一处，并且**真的比对
 * 指纹**而不只是"指纹文件存在"——后者是空断言：源改了、指纹没更新，
 * 文件照样存在。
 *
 * 指纹里也包含生成脚本本身：改了码率 / 质量 / 尺寸上限而源没变时，产物同样
 * 过期，只看源的哈希抓不到。
 */

const ROOT = join(import.meta.dirname, '..')
const A = (...parts: string[]) => join(ROOT, ...parts)

function webpsIn(dir: string): string[] {
  return readdirSync(dir).filter(f => f.endsWith('.webp')).sort()
}

/** 与各脚本里 `stampInputs` 的构成保持一致 */
const PIPELINES = [
  {
    name: 'encode-audio',
    hint: 'node scripts/media/encode-audio.mjs',
    inputs: () => [
      A('media-src/sounds/szumwiatru.mp3'),
      A('media-src/sounds/szummonitorow.mp3'),
      A('media-src/sounds/szummorza.mp3'),
      A('media-src/sounds/szummiasta.mp3'),
      A('public/sounds/bg_corridor.ogg'),
      A('scripts/media/encode-audio.mjs'),
    ],
  },
  {
    name: 'gallery-door',
    hint: 'node scripts/media/gallery-door.mjs',
    inputs: () => [
      ...webpsIn(A('media-src/doors')).map(f => A('media-src/doors', f)),
      A('scripts/media/gallery-door.mjs'),
      A('scripts/media/stickerArt.mjs'),
      A('lib/lab/domain/galleryDoorPlan.mjs'),
    ],
  },
  {
    name: 'optimize-textures',
    hint: 'node scripts/media/optimize-textures.mjs',
    inputs: () => [
      ...webpsIn(A('media-src/textures/entrance')).map(f =>
        A('media-src/textures/entrance', f)),
      A('scripts/media/optimize-textures.mjs'),
    ],
  },
] as const

describe('素材产物与源同步', () => {
  it.each(PIPELINES.map(p => [p.name, p] as const))(
    '%s 的指纹与当前的源、脚本一致',
    (_name, pipeline) => {
      const stamp = readStamp(pipeline.name)
      expect(stamp, `没有指纹，跑 ${pipeline.hint}`).not.toBeNull()
      expect(
        digestOf(pipeline.inputs()),
        `源或生成脚本变了但没重跑：${pipeline.hint}`,
      ).toBe(stamp)
    },
  )

  /*
    字体那条是 Python 写的，指纹里还包含**字符集**（改了中文文案而字体源
    没变时产物同样过期）。在 TS 里复算那个指纹等于把 Python 的实现抄一遍
    ——抄出来的第二份实现迟早与本体不一致，而那正是这套测试要防的事。
    所以这里只断言指纹存在，真正的比对交给 `subset-fonts.py --check`（CI 跑）。
  */
  it('字体指纹存在（内容比对由 subset-fonts.py --check 负责）', () => {
    const stamp = A('media-src/.stamps/subset-fonts.json')
    expect(existsSync(stamp), '跑 python3 scripts/media/subset-fonts.py').toBe(true)
    expect(typeof JSON.parse(readFileSync(stamp, 'utf8')).digest).toBe('string')
  })

  it('指纹文件都在 media-src/.stamps 下 —— 跟源一起提交，不随 public 部署', () => {
    const dir = A('media-src/.stamps')
    expect(existsSync(dir)).toBe(true)
    const stamps = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    expect(stamps).toEqual([
      'encode-audio.json',
      'gallery-door.json',
      'optimize-textures.json',
      'subset-fonts.json',
    ])
  })

  it('指纹不是空壳 —— 每个都有一个 64 位十六进制摘要', () => {
    for (const file of readdirSync(A('media-src/.stamps'))) {
      if (!file.endsWith('.json')) continue
      const { digest } = JSON.parse(readFileSync(A('media-src/.stamps', file), 'utf8'))
      expect(digest, file).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('每条流水线的输入都真实存在 —— 路径写错会让指纹一直"一致"却毫无意义', () => {
    for (const pipeline of PIPELINES) {
      for (const input of pipeline.inputs()) {
        expect(existsSync(input), `${pipeline.name} 的输入不存在：${input}`).toBe(true)
      }
    }
  })

  it('入口页静态首帧存在 —— 不在的话手机端是一块空白', () => {
    const file = A('public/entry/door-firstframe.webp')
    expect(
      existsSync(file),
      '跑 pnpm build && node scripts/media/entry-firstframe.mjs',
    ).toBe(true)
    // 它的意义就是替掉 1553 KB 的 3D 运行时
    expect(statSync(file).size / 1024).toBeLessThan(120)
  })
})
