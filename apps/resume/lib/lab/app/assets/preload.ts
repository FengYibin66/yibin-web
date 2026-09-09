import { useTexture } from '@react-three/drei'

import type { RoomId } from '@/lib/lab/domain/ids'

import { CORRIDOR_TEXTURES, ROOM_ASSETS } from './manifest.gen'

/**
 * 纹理预载的运行时入口，数据来自**派生的**清单 `manifest.gen.ts`
 * （ADR 20260903140615）。
 *
 * 不要退回手写清单：手写表与生成物漂移**不报错**——多预载只是白下载，
 * 漏预载只是某个物件没贴图。实测过三处漂移，其中一处让审计 G1 的修法整段失效。
 *
 * 入口页的纹理不在这里（它属于 `/`，生成器也不扫）：见 `lib/lab/texturePreload.ts`。
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
