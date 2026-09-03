import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DOOR_PLANS,
  STICKER_VIEWBOXES,
  coverSize,
  type StickerKind,
} from '@/lib/lab/domain/galleryDoorPlan.mjs'
import { STICKER_ART } from '../scripts/media/stickerArt.mjs'

/**
 * Gallery 门的贴纸计划（审计 F1）。
 *
 * 通往 `/gallery`（摄影相册）的门贴的是 HTML5 / JS / React / node.js / CSS3。
 * 新贴纸盖旧贴纸，两条几何要求必须成立，否则一眼露馅：
 *
 *   1. **完整覆盖**——盖不严的话旧贴纸从缝里透出来（实机上出现过蓝圆、
 *      红块、`</>`、以及从胶带撕口下露出的「TypeScript」）
 *   2. **不越出门板**——溢出到门外会被裁掉，实机上出现过两张越出右缘的
 *      「f/1.8」
 *
 * 这两条都是纯几何，不需要跑生成脚本就能验。
 */

const ROOT = join(import.meta.dirname, '..')

/** 贴纸旋转后的外接矩形（sharp 输出的就是外接矩形） */
function rotatedBounds(width: number, height: number, degrees: number) {
  const rad = (Math.abs(degrees) * Math.PI) / 180
  return {
    width: width * Math.cos(rad) + height * Math.sin(rad),
    height: width * Math.sin(rad) + height * Math.cos(rad),
  }
}

describe('coverSize', () => {
  it('等比放大，不拉伸 —— 拉伸会把圆的镜头变成椭圆', () => {
    const box = { width: 200, height: 100 }
    const out = coverSize(box, { left: 0, top: 0, width: 400, height: 150 })
    expect(out.width / out.height).toBeCloseTo(box.width / box.height, 6)
  })

  it('两个方向都盖得住', () => {
    const box = { width: 100, height: 100 }
    for (const region of [
      { width: 300, height: 50 },
      { width: 50, height: 300 },
      { width: 120, height: 120 },
    ]) {
      const out = coverSize(box, { left: 0, top: 0, ...region })
      expect(out.width).toBeGreaterThanOrEqual(region.width)
      expect(out.height).toBeGreaterThanOrEqual(region.height)
    }
  })

  it('留了富余 —— 边缘刚好齐平时旧贴纸的白边会露一条', () => {
    const out = coverSize({ width: 100, height: 100 }, { left: 0, top: 0, width: 100, height: 100 })
    expect(out.width).toBeGreaterThan(100)
  })
})

describe('贴纸计划', () => {
  it('每个 kind 都有对应的画法与 viewBox', () => {
    for (const door of DOOR_PLANS) {
      for (const patch of door.patches) {
        expect(STICKER_ART[patch.kind], `${patch.kind} 没有画法`).toBeDefined()
        expect(STICKER_VIEWBOXES[patch.kind], `${patch.kind} 没有 viewBox`).toBeDefined()
      }
    }
  })

  it('画法的 viewBox 与声明里的一致 —— 不一致会让覆盖计算失准', () => {
    // Object.entries 的 key 类型是 string，这里显式收窄回 StickerKind
    for (const kind of Object.keys(STICKER_ART) as StickerKind[]) {
      const declared = STICKER_VIEWBOXES[kind]
      if (!declared) continue
      expect(STICKER_ART[kind].viewBox, kind).toEqual(declared)
    }
  })

  it('每张贴纸完整覆盖它的区域', () => {
    for (const door of DOOR_PLANS) {
      for (const patch of door.patches) {
        const size = coverSize(STICKER_VIEWBOXES[patch.kind], patch.region, { rotate: patch.rotate ?? 0 })
        expect(size.width, `${door.id}/${patch.kind} 宽度盖不住`)
          .toBeGreaterThanOrEqual(patch.region.width)
        expect(size.height, `${door.id}/${patch.kind} 高度盖不住`)
          .toBeGreaterThanOrEqual(patch.region.height)
      }
    }
  })

  it('旋转之后仍然盖得住 —— 旋转只会让外接矩形变大，但不能因此漏角', () => {
    for (const door of DOOR_PLANS) {
      for (const patch of door.patches) {
        const size = coverSize(STICKER_VIEWBOXES[patch.kind], patch.region, { rotate: patch.rotate ?? 0 })
        /*
          旋转后贴纸的**有效覆盖**是原矩形转过一个角度，四角会离开区域的四角。
          保守判据：原矩形的内切范围（转角后仍被覆盖的部分）不小于区域。
          转角 θ 时，宽 w 高 h 的矩形能盖住的正矩形最大为
          w·cosθ − h·sinθ（同理高度）。
        */
        const rad = (Math.abs(patch.rotate ?? 0) * Math.PI) / 180
        const usableW = size.width * Math.cos(rad) - size.height * Math.sin(rad)
        const usableH = size.height * Math.cos(rad) - size.width * Math.sin(rad)
        expect(
          Math.max(usableW, 0),
          `${door.id}/${patch.kind} 旋转 ${patch.rotate}° 后宽度盖不住`,
        ).toBeGreaterThanOrEqual(patch.region.width)
        expect(
          Math.max(usableH, 0),
          `${door.id}/${patch.kind} 旋转 ${patch.rotate}° 后高度盖不住`,
        ).toBeGreaterThanOrEqual(patch.region.height)
      }
    }
  })

  it('贴纸不越出门板 —— 越出会被裁掉，实机上出现过两张越出右缘的标签', () => {
    for (const door of DOOR_PLANS) {
      for (const patch of door.patches) {
        const size = coverSize(STICKER_VIEWBOXES[patch.kind], patch.region, { rotate: patch.rotate ?? 0 })
        const box = rotatedBounds(size.width, size.height, patch.rotate ?? 0)
        const cx = patch.region.left + patch.region.width / 2
        const cy = patch.region.top + patch.region.height / 2
        const left = cx - box.width / 2
        const top = cy - box.height / 2
        expect(left, `${door.id}/${patch.kind} 越出左缘`).toBeGreaterThanOrEqual(-1)
        expect(top, `${door.id}/${patch.kind} 越出上缘`).toBeGreaterThanOrEqual(-1)
        expect(left + box.width, `${door.id}/${patch.kind} 越出右缘`)
          .toBeLessThanOrEqual(door.bounds.width + 1)
        expect(top + box.height, `${door.id}/${patch.kind} 越出下缘`)
          .toBeLessThanOrEqual(door.bounds.height + 1)
      }
    }
  })

  it('区域都在门板内', () => {
    for (const door of DOOR_PLANS) {
      for (const { region, kind } of door.patches) {
        expect(region.left, `${door.id}/${kind}`).toBeGreaterThanOrEqual(0)
        expect(region.top, `${door.id}/${kind}`).toBeGreaterThanOrEqual(0)
        expect(region.left + region.width).toBeLessThanOrEqual(door.bounds.width)
        expect(region.top + region.height).toBeLessThanOrEqual(door.bounds.height)
      }
    }
  })

  it('形状与区域的长宽比接近 —— 差太远会导致巨量溢出（那是 f/1.8 越界的原因）', () => {
    for (const door of DOOR_PLANS) {
      for (const patch of door.patches) {
        const box = STICKER_VIEWBOXES[patch.kind]
        const artRatio = box.width / box.height
        const regionRatio = patch.region.width / patch.region.height
        const off = Math.max(artRatio / regionRatio, regionRatio / artRatio)
        expect(
          off,
          `${door.id}/${patch.kind}：形状 ${artRatio.toFixed(2)} vs 区域 ` +
          `${regionRatio.toFixed(2)}，溢出会到 ${((off - 1) * 100).toFixed(0)}%`,
        ).toBeLessThan(1.75)
      }
    }
  })
})

describe('形状的 silhouette 必须是实的', () => {
  /*
    用作覆盖的贴纸不能有透明区域。

    这三种造型天生带缝：`photoStrip` 三张相纸之间、`camera` 顶部的空白、
    `tape` 的撕口凹角。底下的旧贴纸就从缝里透出来——实机上先后出现过
    「TypeScript」从胶带下露出、Instagram 的粉色从相纸缝里露出、
    YouTube 的红从相机上方露出。**同一个错犯了三次**，所以要有断言。
  */
  it('每个进入计划的形状都调了 fullBleed', () => {
    const kinds = new Set(DOOR_PLANS.flatMap(d => d.patches.map(p => p.kind)))
    for (const kind of kinds) {
      const svg = STICKER_ART[kind].body(1)
      const box = STICKER_VIEWBOXES[kind]
      // fullBleed 产出的正是一个覆盖整个 viewBox 的 rect
      const bleed = new RegExp(
        `<rect x="0" y="0" width="${box.width}" height="${box.height}"`,
      )
      expect(
        bleed.test(svg),
        `${kind} 没有满幅不透明衬底，底下的旧贴纸会从透明处透出来`,
      ).toBe(true)
    }
  })

  it('衬底画在最前面 —— 画在后面会把图案盖掉', () => {
    for (const kind of new Set(DOOR_PLANS.flatMap(d => d.patches.map(p => p.kind)))) {
      const svg = STICKER_ART[kind].body(1)
      const box = STICKER_VIEWBOXES[kind]
      const bleedAt = svg.indexOf(`<rect x="0" y="0" width="${box.width}"`)
      // 第一个"内容"元素：衬底之后才该出现别的可见图元
      const firstOther = svg.slice(bleedAt + 10).search(/<(rect|circle|path|g|text)\b/)
      expect(bleedAt, `${kind} 找不到衬底`).toBeGreaterThan(-1)
      expect(firstOther, `${kind} 衬底之后没有图案`).toBeGreaterThan(-1)
    }
  })
})

describe('产物', () => {
  it('原图在 media-src/doors（不随 public 部署）', () => {
    for (const door of DOOR_PLANS) {
      expect(
        existsSync(join(ROOT, 'media-src/doors', `${door.id}.webp`)),
        `${door.id} 的原图不在 media-src/doors`,
      ).toBe(true)
    }
  })

  it('生成物比原图新 —— 改了计划忘了重新生成的话，线上还是旧贴纸', () => {
    for (const door of DOOR_PLANS) {
      const src = join(ROOT, 'media-src/doors', `${door.id}.webp`)
      const dst = join(ROOT, 'public/textures', door.dir, `${door.id}.webp`)
      expect(existsSync(dst), `${door.id} 没有生成物`).toBe(true)
      expect(
        statSync(dst).mtimeMs,
        `${door.id} 的生成物比原图旧，跑 node scripts/media/gallery-door.mjs`,
      ).toBeGreaterThanOrEqual(statSync(src).mtimeMs)
    }
  })
})
