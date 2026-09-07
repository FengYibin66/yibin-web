import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { credentialsEn, credentialsZh } from '@/lib/content/credentials'
import type { CredentialItem } from '@/lib/content/types'

/**
 * 荣誉与证书页的图片资产（2026-09-06）。
 *
 * 这页原来直接发 `public/` 里的原图：11 张共 **7064 KB**，最大一张 `NECCS.png`
 * 2060 KB——证书照片存成 PNG。卡片只有约 368px 宽，灯箱最宽 960px。
 * 还有一张 `CSCS_Card_back.png`（508 KB）数据里没引用，每次部署白发。
 *
 * 现在原图住 `media-src/credentials/`，`scripts/media/optimize-credentials.mjs`
 * 出 webp 到 `public/credentials/`。这里守三件事：
 *
 * 1. 数据引用的每张图都真的有产物——漏一张那张卡就是空的
 * 2. 体积预算（单张 + 总量）——素材是一张一张加的，每次都"只多一张"
 * 3. **竖版文件必须标 `fit: 'contain'`**——从原图尺寸算出来，不靠人记
 *
 * 「产物是否与源同步」由 `mediaFreshness.test.ts` 统一比对指纹。
 */

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'public/credentials')
const SRC = join(ROOT, 'media-src/credentials')

/** 总量上限。当前实测 1146 KB（11 张），留约 30% 余量 */
const TOTAL_BUDGET_KB = 1500
/** 单张上限。当前最大 226 KB（UNESCO_2，1600px / q80 的高熵证书照片） */
const PER_FILE_BUDGET_KB = 300

function allItems(): CredentialItem[] {
  return [
    ...credentialsZh.awards, ...credentialsZh.certificates,
    ...credentialsEn.awards, ...credentialsEn.certificates,
  ]
}

function webpsUnder(dir: string): string[] {
  return readdirSync(dir)
    .flatMap(group => readdirSync(join(dir, group)).map(f => join(group, f)))
    .filter(f => f.endsWith('.webp'))
    .sort()
}

describe('荣誉与证书的图片资产', () => {
  it('原图在 media-src/credentials（不随 public 部署），public 下只有 webp', () => {
    expect(existsSync(SRC)).toBe(true)
    const leftovers = readdirSync(OUT)
      .flatMap(group => readdirSync(join(OUT, group)).map(f => join(group, f)))
      .filter(f => /\.(jpe?g|png)$/i.test(f))
    expect(leftovers, 'public/credentials 下不该再有原图').toEqual([])
  })

  it('数据引用的每张图都有产物，且都是 webp', () => {
    for (const item of allItems()) {
      if (!item.image) continue
      expect(item.image, `${item.id} 该引用 webp 产物`).toMatch(/\.webp$/)
      expect(existsSync(join(ROOT, 'public', item.image)), `${item.id} 的图不存在：${item.image}`).toBe(true)
    }
  })

  it('中英两份引用同一组图 —— 图不分语言', () => {
    const zh = [...credentialsZh.awards, ...credentialsZh.certificates].map(i => i.image).sort()
    const en = [...credentialsEn.awards, ...credentialsEn.certificates].map(i => i.image).sort()
    expect(zh).toEqual(en)
  })

  it(`总量不超过 ${TOTAL_BUDGET_KB} KB`, () => {
    const files = webpsUnder(OUT)
    expect(files.length).toBeGreaterThan(0)
    const total = files.reduce((sum, f) => sum + statSync(join(OUT, f)).size / 1024, 0)
    expect(
      total,
      `证书图片合计 ${total.toFixed(0)} KB，超了预算。要么继续瘦身，要么先解释为什么值得抬这条线`,
    ).toBeLessThan(TOTAL_BUDGET_KB)
  })

  it(`单张不超过 ${PER_FILE_BUDGET_KB} KB`, () => {
    const offenders = webpsUnder(OUT)
      .map(f => [f, statSync(join(OUT, f)).size / 1024] as const)
      .filter(([, kb]) => kb > PER_FILE_BUDGET_KB)
      .map(([f, kb]) => `${f} ${kb.toFixed(0)} KB`)
    expect(offenders, `这些单张超限：\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('没有产物是数据里没引用的 —— 死资产每次部署都白发', () => {
    const referenced = new Set(allItems().map(i => i.image?.replace(/^\/credentials\//, '')))
    const orphans = webpsUnder(OUT).filter(f => !referenced.has(f))
    expect(orphans, '这些产物没人引用，在生成脚本 PLAN 里标 unused').toEqual([])
  })

  it('竖版文件标了 fit: contain，横版没标 —— 按原图尺寸算，不靠人记', async () => {
    /*
      证书是文件，`object-cover` 裁一刀就把底部的印章 / 签名切掉了（NECCS 那张
      实机可见）。横版塞进 4:3 卡片只是略裁边，竖版则会丢掉近一半。
      这条从 media-src 的原图量出方向，与数据里的 `fit` 对账，
      将来加一张竖版证书忘了标会红在这里。
    */
    const seen = new Set<string>()
    for (const item of allItems()) {
      if (!item.image || seen.has(item.image)) continue
      seen.add(item.image)
      const rel = item.image.replace(/^\/credentials\//, '').replace(/\.webp$/, '')
      const [group, stem] = rel.split('/')
      const srcFile = readdirSync(join(SRC, group)).find(f => f.replace(/\.[^.]+$/, '') === stem)
      expect(srcFile, `${item.id} 在 media-src 里找不到原图`).toBeDefined()
      const { width = 0, height = 0, orientation } = await sharp(join(SRC, group, srcFile!)).metadata()
      // EXIF 5–8 是转了 90° 的方向，宽高要对调
      const portrait = (orientation ?? 1) >= 5 ? width > height : height > width
      expect(
        item.fit === 'contain',
        `${item.id}（${width}×${height}${portrait ? '，竖版' : '，横版'}）的 fit 标错了`,
      ).toBe(portrait)
    }
  })
})
