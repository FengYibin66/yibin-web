import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SketchSpec } from '@/lib/lab/domain/sketch/types'

/**
 * 缓存层。三件事值得测，因为它们静默坏掉时都没有症状：
 *
 *   1. 同 spec 复用同一张纹理——不复用就是每次重渲染新建一张 CanvasTexture
 *      且不 dispose，显存泄漏在开发机上看不出来
 *   2. 字体到位后重画——不重画的话首访者永远看到衬线体的"手写"便签
 *      （`font-display: swap` + canvas 已栅格化，字体后到不会自动重绘）
 *   3. dispose 真的清空——否则测试之间互相污染
 *
 * roughjs 在 jsdom 里能跑（它只要 canvas 2d context 的路径 API），
 * 但 `getContext('2d')` 在 jsdom 里返回 null，所以 rasterize 会走
 * "拿不到 context 就返回空 canvas" 那条分支。这不影响本文件要验的东西
 * ——缓存与重画时序都在 canvas 之外。
 */

const SPEC: SketchSpec = {
  kind: 'sticky',
  id: 'cache-test',
  size: { width: 200, height: 150 },
  title: 'T',
  lines: ['a'],
}

let mod: typeof import('@/lib/lab/infra/sketch/textureCache')

beforeEach(async () => {
  vi.resetModules()
  mod = await import('@/lib/lab/infra/sketch/textureCache')
})

afterEach(() => {
  mod.disposeSketchTextures()
})

describe('sketchTexture', () => {
  it('同 spec 返回同一个纹理实例 —— 不复用等于每帧泄漏一张', () => {
    const a = mod.sketchTexture(SPEC)
    const b = mod.sketchTexture(SPEC)
    expect(a).toBe(b)
    expect(mod.sketchCacheSize()).toBe(1)
  })

  it('内容变了但 id 没变 → 仍命中缓存（有意的权衡，见 specKey 注释）', () => {
    const a = mod.sketchTexture(SPEC)
    const b = mod.sketchTexture({ ...SPEC, title: '完全不同' } as SketchSpec)
    expect(a).toBe(b)
  })

  it('id 不同 → 各自一张', () => {
    mod.sketchTexture(SPEC)
    mod.sketchTexture({ ...SPEC, id: 'other' } as SketchSpec)
    expect(mod.sketchCacheSize()).toBe(2)
  })

  it('kind 相同 id 相同但类型不同的 spec 不会撞车', () => {
    mod.sketchTexture(SPEC)
    mod.sketchTexture({ kind: 'tape', id: 'cache-test', size: SPEC.size, text: 'x' })
    expect(mod.sketchCacheSize()).toBe(2)
  })

  it('设 sRGB 色彩空间 —— 不设的话纸色会偏暗，与走廊纹理对不上', () => {
    const t = mod.sketchTexture(SPEC)
    expect(t.colorSpace).toBe('srgb')
  })

  it('开了各向异性过滤 —— 便签是斜着看的，不开会糊', () => {
    expect(mod.sketchTexture(SPEC).anisotropy).toBeGreaterThan(1)
  })

  /*
    `needsUpdate` 在 three.js 里**只有 setter**（`set needsUpdate(v)` 递增
    `version`），没有 getter——读它永远是 undefined。所以要验"请求了重新上传
    纹理"，看的是 `version` 有没有涨，而不是 needsUpdate 的值。
  */
  it('字体就绪后就地换 image 并请求重新上传（同一个纹理对象，引用保持有效）', async () => {
    const t = mod.sketchTexture(SPEC)
    const before = t.image
    const v0 = t.version

    // whenFontReady 的 then 排在微任务队列里
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(t.version, '字体到位后没有请求重新上传纹理').toBeGreaterThan(v0)
    expect(t.image, '应该换了一张新画的 canvas').not.toBe(before)
    expect(mod.sketchTexture(SPEC), '重画不该换掉纹理对象本身').toBe(t)
  })

  it('只重画一次 —— 反复取同一张不该反复触发重画', async () => {
    const t = mod.sketchTexture(SPEC)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const afterFirst = t.image
    const settled = t.version

    mod.sketchTexture(SPEC)
    mod.sketchTexture(SPEC)
    await Promise.resolve()
    await Promise.resolve()

    expect(t.image).toBe(afterFirst)
    expect(t.version, '又重画了一次').toBe(settled)
  })
})

describe('disposeSketchTextures', () => {
  it('清空缓存并 dispose 每一张', () => {
    const t = mod.sketchTexture(SPEC)
    const spy = vi.spyOn(t, 'dispose')
    mod.disposeSketchTextures()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(mod.sketchCacheSize()).toBe(0)
  })

  it('清空后再取会新建 —— 不能返回已 dispose 的纹理', () => {
    const a = mod.sketchTexture(SPEC)
    mod.disposeSketchTextures()
    expect(mod.sketchTexture(SPEC)).not.toBe(a)
  })
})
