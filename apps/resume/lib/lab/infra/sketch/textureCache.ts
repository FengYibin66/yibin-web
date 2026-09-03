/**
 * `SketchSpec` → `THREE.CanvasTexture`，按 spec 身份缓存。
 *
 * 缓存不是优化，是**正确性要求**：`planSketch` 的种子由 specKey 派生，所以
 * 同 spec 必得同图；但每次重画都要跑一遍 roughjs 的路径生成 + canvas 栅格化，
 * 而房间组件在 React 里会重渲染多次。不缓存的话每次重渲染都新建一张
 * `CanvasTexture` 却不 dispose → 显存泄漏，而这在开发机上看不出来。
 *
 * 缓存键就是 `specKey(spec)`（`kind:id`）。**改了内容不改 id 不会失效**
 * ——见 `specKey` 的注释，这是有意的：声明是构建期常量。
 */
import * as THREE from 'three'

import { planSketch } from '@/lib/lab/domain/sketch/plan'
import { specKey, type SketchSpec } from '@/lib/lab/domain/sketch/types'

import { ensureHandFont, rasterizeOps } from './rasterize'

interface Entry {
  texture: THREE.CanvasTexture
  /** 字体到位后是否已重画过一次 */
  refreshed: boolean
}

const cache = new Map<string, Entry>()

/** 首次调用时启动一次字体加载，后续复用同一个 Promise */
let fontReady: Promise<void> | null = null
function whenFontReady(): Promise<void> {
  fontReady ??= ensureHandFont()
  return fontReady
}

function draw(spec: SketchSpec): HTMLCanvasElement {
  return rasterizeOps(planSketch(spec), {
    width: spec.size.width,
    height: spec.size.height,
  })
}

/**
 * 取（或生成）一张手绘纹理。
 *
 * 同步返回，所以调用侧不必处理 Suspense —— 这一点是刻意的：房间的
 * Suspense 边界里多挂一个异步资源就多一条撑爆 8 秒加载超时的路径
 * （审计 A5 就是这么发生的）。
 *
 * 字体未就绪时先用兜底字体画一版，字体到位后**就地重画同一张 canvas** 并
 * 置 `needsUpdate`。这样既不阻塞首帧，也不会留下衬线体的手写便签。
 */
export function sketchTexture(spec: SketchSpec): THREE.CanvasTexture {
  const key = specKey(spec)
  const hit = cache.get(key)
  if (hit) return hit.texture

  const texture = new THREE.CanvasTexture(draw(spec))
  texture.colorSpace = THREE.SRGBColorSpace
  // 纸质纹理贴在平面上，各向异性过滤对斜视角的清晰度影响很大
  texture.anisotropy = 4
  texture.needsUpdate = true

  const entry: Entry = { texture, refreshed: false }
  cache.set(key, entry)

  void whenFontReady().then(() => {
    if (entry.refreshed) return
    entry.refreshed = true
    // 换掉 image 而不是新建 texture：已经贴到材质上的引用要保持有效
    texture.image = draw(spec)
    texture.needsUpdate = true
  })

  return texture
}

/**
 * 释放全部缓存纹理。
 *
 * 给测试与「离开 Lab」用。**不在房间卸载时调**——缓存的价值正是跨房间进出
 * 复用；每次退房清掉就等于没缓存。
 */
export function disposeSketchTextures(): void {
  for (const { texture } of cache.values()) texture.dispose()
  cache.clear()
  fontReady = null
}

/** 测试用：当前缓存了多少张 */
export function sketchCacheSize(): number {
  return cache.size
}
