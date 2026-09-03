import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildCloudField } from '@/components/rooms/gallery/GalleryClouds'
import { CLOUD_TEXTURES, cloudAspect, CLOUD_FALLBACK_ASPECT } from '@/lib/lab/cloudTextures'
import { ROOM_ASSETS } from '@/lib/lab/app/assets/manifest.gen'

/**
 * 云场生成的回归测试（审计 A2）。
 *
 * 复现过的故障：Contact 房间天空里飘着**四个灰色矩形**。那段代码注释写着
 * "Simple clouds"，实现是 `planeGeometry + meshBasicMaterial color="#fff"`
 * ——从来没贴过云纹理。而云纹理就在仓库里（`CLOUD_TEXTURES`，8 张），
 * About 与 Publications 两个房间都在用，只有 `ROOM_ASSETS.contact` 没收。
 *
 * 修法是复用已有的 `GalleryClouds`（带漂移、billboard、原始宽高比处理），
 * 而不是在 ContactRoom 里再手搓一份贴图逻辑。为此把云场布局提成纯函数
 * `buildCloudField` 并参数化高度/深度范围——Contact 是海景，云比
 * Publications 的城市屋顶低。
 */

const APP_ROOT = join(__dirname, '..')

const CONTACT_FIELD = {
  count: 10,
  seed: 7,
  yRange: [2, 6] as const,
  zRange: [-8, -20] as const,
  baseWidth: 3,
  startX: 30,
  endX: -30,
}

describe('buildCloudField', () => {
  it('生成指定数量的云', () => {
    expect(buildCloudField({ ...CONTACT_FIELD, count: 10 })).toHaveLength(10)
    expect(buildCloudField({ ...CONTACT_FIELD, count: 1 })).toHaveLength(1)
    expect(buildCloudField({ ...CONTACT_FIELD, count: 0 })).toHaveLength(0)
  })

  it('同一 seed 结果稳定，不同 seed 结果不同 —— 云不能每帧重排', () => {
    const a = buildCloudField(CONTACT_FIELD)
    const b = buildCloudField(CONTACT_FIELD)
    const c = buildCloudField({ ...CONTACT_FIELD, seed: 99 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('y / z 落在给定范围内 —— 参数化的意义就在这', () => {
    for (const cloud of buildCloudField(CONTACT_FIELD)) {
      const [, y, z] = cloud.position
      expect(y).toBeGreaterThanOrEqual(2)
      expect(y).toBeLessThanOrEqual(6)
      expect(z).toBeLessThanOrEqual(-8)
      expect(z).toBeGreaterThanOrEqual(-20)
    }
  })

  it('每朵云都指向一张真实的云纹理', () => {
    for (const cloud of buildCloudField(CONTACT_FIELD)) {
      expect(cloud.textureIndex).toBeGreaterThanOrEqual(0)
      expect(cloud.textureIndex).toBeLessThan(CLOUD_TEXTURES.length)
    }
  })

  it('不透明度与缩放在合理区间 —— 防止参数改动把云变成不可见或糊满屏', () => {
    for (const cloud of buildCloudField(CONTACT_FIELD)) {
      expect(cloud.opacity).toBeGreaterThan(0.1)
      expect(cloud.opacity).toBeLessThanOrEqual(1)
      expect(cloud.scale).toBeGreaterThan(0)
      expect(cloud.scale).toBeLessThan(3)
    }
  })
})

describe('云纹理清单是单一来源', () => {
  it('每张纹理都有显式宽高比 —— 落到兜底值意味着清单漏了一条', () => {
    for (const texture of CLOUD_TEXTURES) {
      expect(cloudAspect(texture), `${texture} 没有登记宽高比`).not.toBe(
        CLOUD_FALLBACK_ASPECT,
      )
    }
  })

  it('查不到的路径返回兜底值，不返回 NaN —— NaN 会把 planeGeometry 撑坏', () => {
    expect(cloudAspect('/textures/clouds/does-not-exist.webp')).toBe(CLOUD_FALLBACK_ASPECT)
    expect(Number.isFinite(cloudAspect(''))).toBe(true)
  })

  it('没有其它文件再自带一份副本', () => {
    const probe = CLOUD_TEXTURES[0]!
    const copies = [
      'components/rooms/about/SkyChunk.tsx',
      'components/rooms/gallery/GalleryClouds.tsx',
      'lib/lab/domain/rooms/about.ts',
    ].filter((rel) => readFileSync(join(APP_ROOT, rel), 'utf8').includes(probe))

    expect(copies, `以下文件里仍有硬编码的云纹理路径：${copies.join(', ')}`).toEqual([])
  })
})

describe('Contact 房间的云（审计 A2）', () => {
  it('ROOM_ASSETS.contact 收了云纹理 —— 否则进房才开始下载', () => {
    for (const texture of CLOUD_TEXTURES) {
      expect(ROOM_ASSETS.contact, `contact 缺 ${texture}`).toContain(texture)
    }
  })

  it('ContactRoom 不再自己画无贴图的白色矩形', () => {
    const source = readFileSync(
      join(APP_ROOT, 'components/rooms/ContactRoom.tsx'),
      'utf8',
    )
    expect(source).not.toContain('Simple clouds')
    expect(source).toContain('GalleryClouds')
  })
})
