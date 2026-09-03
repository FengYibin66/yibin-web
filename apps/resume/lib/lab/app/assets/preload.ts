import { useTexture } from '@react-three/drei'

import type { RoomId } from '@/lib/lab/domain/ids'

import { CORRIDOR_TEXTURES, ROOM_ASSETS } from './manifest.gen'

/**
 * 纹理预载的运行时入口 —— 数据来自**派生的**清单（ADR 20260903140615）。
 *
 * ## 它取代了什么
 *
 * 原先有两份**手写**清单：`lib/lab/roomAssets.ts` 与 `lib/lab/texturePreload.ts`。
 * 生成物 `manifest.gen.ts` 早就存在（CI 也在跑它的 `--check`），但**唯一引用它的
 * 是生成它的脚本自己**——运行时从来读的是手写表。
 *
 * 两份表因此漂移，而漂移不报错：
 *
 * - 注册表声明 Projects 有 18 张纹理，手写表 15 张
 * - 手写表的首屏壁画是 **3 段（16 张）**，生成物写的是 1 段
 *   ——**审计 G1（首屏 7.6MB）的修法一直没生效**
 * - 手写表为已删除的组件（`CorridorWindow`、`InspectableFrame`）预载纹理，
 *   同时漏收 Contact 的云纹理（表现是天空里四个没贴图的灰矩形，审计 A2）
 *
 * 这些症状的共同点是**不报错**：多预载只是白下载，漏预载只是某个物件没贴图。
 *
 * ## 边界
 *
 * 入口页的纹理（`ENTRANCE_TEXTURES`）不在这里：它属于 `/` 那一页，不是 Lab，
 * 生成器也不扫它。见 `lib/lab/texturePreload.ts`。
 */

/** 已经预载过的房间。重复调用是常态（每次靠近门都会调） */
const preloaded = new Set<string>()

/**
 * 预载一个房间的纹理。幂等。
 *
 * `gallery` 走独立路由、不在 Canvas 里，注册表里它的 `assets` 是空数组，
 * 所以这里不需要特例分支——那正是数据驱动想要的效果。
 */
export function preloadRoomAssets(roomId: RoomId): void {
  if (preloaded.has(roomId)) return
  preloaded.add(roomId)
  for (const asset of ROOM_ASSETS[roomId] ?? []) {
    useTexture.preload(asset)
  }
}

/**
 * 清掉再重载一个房间的纹理 —— 加载失败后重试用。
 *
 * 必须先 `clear`：drei 的 `useTexture` 缓存里若留着失败的 promise，
 * 重试会立刻拿到同一个失败，表现为"点了重试没反应"。
 */
export function reloadRoomAssets(roomId: RoomId): void {
  for (const asset of ROOM_ASSETS[roomId] ?? []) {
    useTexture.clear(asset)
  }
  preloaded.delete(roomId)
  preloadRoomAssets(roomId)
}

/**
 * 预载走廊的首屏纹理。
 *
 * 只含**第一段**的壁画（`FIRST_SCREEN_MURAL_SEGMENTS = 1`）：更深的段等 idle 时
 * 再取。手写表那份是 3 段共 16 张壁画，于是 loader 要等 7.6MB 下完才退场
 * ——审计 G1。
 */
export function preloadCorridorTextures(): void {
  for (const path of CORRIDOR_TEXTURES) {
    useTexture.preload(path)
  }
}

/** 清空预载记录。**只给测试用** */
export function resetPreloadState(): void {
  preloaded.clear()
}
