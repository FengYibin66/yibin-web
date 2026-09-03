import { useTexture } from '@react-three/drei'

/**
 * 入口页（`/`）的纹理预载。
 *
 * ## 走廊那部分搬走了
 *
 * 这个文件原先还有一份**手写的** `CORRIDOR_TEXTURES` 与
 * `preloadCorridorTextures()`。它们已被 `lib/lab/app/assets/preload.ts` 取代
 * ——后者读的是**派生的**清单 `manifest.gen.ts`（ADR 20260903140615）。
 *
 * 手写那份与生成物漂移过，而漂移不报错：它的首屏壁画是 **3 段（16 张）**，
 * 生成物写的是 1 段，于是 loader 要等 7.6MB 下完才退场——**审计 G1 的修法一直
 * 没生效，因为运行时从来没读过生成物**（生成物唯一的引用者是生成它的脚本）。
 *
 * 入口页的纹理留在这里：它属于 `/` 那一页而不是 Lab，生成器也不扫它
 * （它扫的来源是 `lib/lab/domain/rooms/*.ts` 与 `components/lab/**`）。
 */

export const ENTRANCE_TEXTURES: string[] = [
  '/textures/entrance/wall_bricks_2.webp',
  '/textures/entrance/floor_paper.webp',
  '/textures/entrance/tree_sketch.webp',
  '/textures/entrance/mouse_hanging.webp',
  '/textures/entrance/window_sketch.webp',
  '/textures/entrance/avatar_window.webp',
  '/textures/entrance/pot_with_duck.webp',
  '/textures/entrance/stone-path.webp',
  '/textures/entrance/sign.webp',
  '/textures/entrance/speech_bubble.webp',
  '/textures/entrance/bug_sketch.webp',
  '/textures/corridor/ink_splash.webp',
  '/textures/corridor/cat_body.webp',
  // Entrance door reuses corridor door assets
  '/textures/corridor/doors/ramkasingledoors.webp',
  '/textures/corridor/doors/drzwiabout.webp',
  '/textures/corridor/doors/drzwiabout_painted.webp',
  '/textures/corridor/doors/klamkadodrzwi.webp',
  '/textures/corridor/doors/klamkadodrzwi_painted.webp',
]

export function preloadEntranceTextures(): void {
  ENTRANCE_TEXTURES.forEach(url => useTexture.preload(url))
}
