'use client'

import { useTexture } from '@react-three/drei'
import type { RoomId } from '@/context/SceneContext'
import { CLOUD_TEXTURES } from './cloudTextures'

type OrdinaryRoomId = Exclude<RoomId, 'gallery'>

// CLOUD_TEXTURES 现在从 ./cloudTextures 导入（原先此处、SkyChunk、GalleryClouds
// 三个文件各有一份拷贝，见那个文件顶部注释）

/**
 * 只剩纸张音效。
 *
 * 原先第二项是 `/sounds/szummiasta.mp3`（2.55MB，320kbps 立体声城市环境音），
 * 由 `usePublicationCityAmbience` 用裸 `new Audio()` 播放——那是全站第四套
 * 音频实现。环境音已按 ADR 20260903140618 收归 `RoomAmbience` + AudioMixer，
 * 走 `amb_publications.m4a`（单声道 64kbps，525KB）**且按需加载**。
 *
 * 留着它的代价不是"多一个没用的常量"：这份清单会被 `preloadRoomAssets`
 * 预载，所以每个进 Publications 房间的访客都在下载一个再也不会播放的
 * 2.55MB 文件。
 */
export const PUBLICATION_AUDIO_ASSETS = [
  '/sounds/papersound.mp3',
] as const

export const ROOM_ASSETS: Readonly<Record<OrdinaryRoomId, readonly string[]>> = {
  about: [
    '/textures/about/awatarnachmurce.webp',
    '/textures/about/uowyspa.webp',
    '/textures/about/freelancewyspa.webp',
    ...CLOUD_TEXTURES,
  ],
  projects: [
    '/textures/studio/monitor_front.webp',
    '/textures/studio/monitor_front_painted.webp',
    '/textures/studio/monitor_back.webp',
    '/textures/studio/monitor_back_painted.webp',
    '/textures/studio/monitor_top.webp',
    '/textures/studio/monitor_top_painted.webp',
    '/textures/studio/monitor_bottom.webp',
    '/textures/studio/monitor_bottom_painted.webp',
    '/textures/studio/monitor_left.webp',
    '/textures/studio/monitor_left_painted.webp',
    '/textures/studio/monitor_right.webp',
    '/textures/studio/monitor_right_painted.webp',
    '/textures/studio/tv_front.webp',
    '/textures/studio/tv_front_painted.webp',
    '/textures/studio/tv_back.webp',
    '/textures/studio/tv_back_painted.webp',
    '/textures/studio/tv_top.webp',
    '/textures/studio/tv_top_painted.webp',
    '/textures/studio/tv_bottom.webp',
    '/textures/studio/tv_bottom_painted.webp',
    '/textures/studio/tv_side.webp',
    '/textures/studio/tv_side_painted.webp',
    '/textures/studio/phone_front.webp',
    '/textures/studio/phone_front_painted.webp',
    '/textures/studio/phone_back.webp',
    '/textures/studio/phone_back_painted.webp',
    '/textures/studio/phone_side.webp',
    '/textures/studio/phone_side_painted.webp',
  ],
  publications: [
    '/textures/gallery/floor.webp',
    '/textures/gallery/railing.webp',
    '/textures/corridor/texturadoprogow.webp',
    '/textures/gallery/domki.webp',
    '/textures/gallery/miastotlo.webp',
    '/textures/gallery/bird_gray.webp',
    '/textures/gallery/klamerka.webp',
    '/textures/gallery/tylkartki.webp',
    '/textures/gallery/tylkartki_painted.webp',
    '/textures/gallery/przyciskdotylukartki.webp',
    '/textures/gallery/przyciskdotylukartki_painted.webp',
    '/textures/gallery/monetuneprzod.webp',
    '/textures/gallery/monetuneprzod_painted.webp',
    '/textures/gallery/timberkittyprzod.webp',
    '/textures/gallery/timberkittyprzod_painted.webp',
    '/textures/gallery/youngmultiprzod.webp',
    '/textures/gallery/youngmultiprzod_painted.webp',
    '/textures/gallery/bioprzod.webp',
    '/textures/gallery/bioprzod_painted.webp',
    ...CLOUD_TEXTURES,
  ],
  contact: [
    '/textures/contact/faletopdown.webp',
    '/textures/contact/molo.webp',
    '/textures/contact/latarnia.webp',
    '/textures/contact/statek.webp',
    '/textures/contact/beczka.webp',
    '/textures/contact/beczka_painted.webp',
    '/textures/contact/paper_form.webp',
    '/textures/contact/send_button.webp',
    // 漏收这批就是审计 A2：Contact 的云退化成四个无贴图的灰矩形
    ...CLOUD_TEXTURES,
  ],
}

const preloadedRooms = new Set<RoomId>()

export function preloadRoomAssets(roomId: OrdinaryRoomId): void {
  if (preloadedRooms.has(roomId)) return

  preloadedRooms.add(roomId)
  const assets = ROOM_ASSETS[roomId]
  assets.forEach(asset => useTexture.preload(asset))
}

export function reloadRoomAssets(roomId: OrdinaryRoomId): void {
  ROOM_ASSETS[roomId].forEach(asset => useTexture.clear(asset))
  preloadedRooms.delete(roomId)
  preloadRoomAssets(roomId)
}
