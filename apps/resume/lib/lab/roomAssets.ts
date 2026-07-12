'use client'

import { useTexture } from '@react-three/drei'
import type { RoomId } from '@/context/SceneContext'

type OrdinaryRoomId = Exclude<RoomId, 'gallery'>

const CLOUD_TEXTURES = [
  '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
  '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
  '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
  '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
  '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
  '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
  '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
  '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
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
    '/textures/gallery/domki.webp',
    '/textures/gallery/miastotlo.webp',
    '/textures/gallery/bird_gray.webp',
    '/textures/gallery/klamerka.webp',
    '/textures/gallery/tylkartki.webp',
    '/textures/gallery/przyciskdotylukartki.webp',
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
  ],
}

const preloadedRooms = new Set<RoomId>()

export function preloadRoomAssets(roomId: OrdinaryRoomId): void {
  if (preloadedRooms.has(roomId)) return

  preloadedRooms.add(roomId)
  const assets = ROOM_ASSETS[roomId]
  console.info(`[progress] preloading ${assets.length} ${roomId} room assets`)
  assets.forEach(asset => useTexture.preload(asset))
}
