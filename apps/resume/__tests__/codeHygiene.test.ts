import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { galleryYearLabel, galleryYearRange, galleryRooms } from '@/lib/gallery/data'
import { content } from '@/lib/content'

/**
 * 代码卫生门禁。
 *
 * 两类问题在审计里各占一条，共同点是"不会报错，只会慢慢腐烂"：
 *
 * - **A9**：`components/rooms/publications/` 下有 40+ 条 `console.log('[pub-debug]')`，
 *   每次打开一张卡片输出 15 行 VISIBILITY dump（含矩阵投影计算）。调试代码进了生产。
 * - **F10**：三处写死 "Photography · 2019–2024"，而相册里已经有 2025 年的照片；
 *   Gallery 页脚写 "© 2024" 而 Classic 页脚写 "© 2026"。
 */

const APP_ROOT = join(__dirname, '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next' || entry === 'out') return []
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function productionSources(): { file: string; source: string }[] {
  return ['components', 'lib', 'hooks', 'context', 'app']
    .flatMap((dir) => walk(join(APP_ROOT, dir)))
    .filter((f) => /\.tsx?$/.test(f))
    .map((file) => ({ file: file.replace(`${APP_ROOT}/`, ''), source: readFileSync(file, 'utf8') }))
}

describe('生产代码里没有调试日志（审计 A9）', () => {
  const sources = productionSources()

  it('扫到了足够多的文件 —— 防止路径写错后测试变成空跑', () => {
    expect(sources.length).toBeGreaterThan(80)
  })

  it('没有 console 语句', () => {
    const hits: string[] = []
    for (const { file, source } of sources) {
      source.split('\n').forEach((line, i) => {
        // 只看语句起始的 console.（字符串字面量里提到它不算——入口页鸭子的
        // 台词就是 "Have you tried console.log()?"）
        if (/^\s*console\.(log|warn|info|error|debug|table|dir)\s*\(/.test(line)) {
          hits.push(`  ${file}:${i + 1}  ${line.trim().slice(0, 70)}`)
        }
      })
    }
    expect(hits, `以下位置有 console 语句：\n${hits.join('\n')}`).toEqual([])
  })

  it('没有 [pub-debug] 这类调试标记残留', () => {
    const hits = sources
      .filter(({ source }) => source.includes('[pub-debug]'))
      .map(({ file }) => file)
    expect(hits).toEqual([])
  })
})

describe('年份不写死（审计 F10）', () => {
  it('galleryYearRange 覆盖数据里的真实区间', () => {
    const { from, to } = galleryYearRange()
    expect(from).toBe(2019) // 最早：kualalumpur 2019–2020
    expect(to).toBeGreaterThanOrEqual(2025) // 最新：ai4sg / life 有 2025
    expect(to).toBeLessThanOrEqual(new Date().getFullYear() + 1)
  })

  it('两种 year 写法都能解析', () => {
    expect(
      galleryYearRange([
        { id: 'a', title: 'A', subtitle: '', year: '2021–2022', images: [] },
      ]),
    ).toEqual({ from: 2021, to: 2022 })

    expect(
      galleryYearRange([
        {
          id: 'b',
          title: 'B',
          subtitle: '',
          year: '2020',
          images: [{ src: 'x', caption: 'c', year: '2023', location: 'l' }],
        },
      ]),
    ).toEqual({ from: 2020, to: 2023 })
  })

  it('空数据抛错而不是返回 Infinity —— 静默的坏值比报错更糟', () => {
    expect(() => galleryYearRange([])).toThrow(/没有任何四位年份/)
  })

  it('单一年份不显示区间', () => {
    expect(
      galleryYearLabel([{ id: 'a', title: 'A', subtitle: '', year: '2024', images: [] }]),
    ).toBe('2024')
  })

  it('组件里没有残留的写死年份区间', () => {
    for (const rel of [
      'components/gallery/GalleryTrack.tsx',
      'components/sections/GalleryDoorSection.tsx',
    ]) {
      const source = readFileSync(join(APP_ROOT, rel), 'utf8')
      expect(source, `${rel} 仍写死了年份区间`).not.toMatch(/20\d\d\s*[–-]\s*20\d\d/)
    }
  })

  it('Gallery 与 Classic 的版权年份同源', () => {
    const track = readFileSync(join(APP_ROOT, 'components/gallery/GalleryTrack.tsx'), 'utf8')
    expect(track).toContain('footer.copyright')
    // 两个 locale 的 copyright 必须一致，否则切语言版权年会变
    expect(content.en.footer.copyright).toBe(content.zh.footer.copyright)
  })

  it('相册数据非空 —— 上面几条断言的前提', () => {
    expect(galleryRooms.length).toBeGreaterThan(5)
  })
})
