import { CLOUD_TEXTURES } from '@/lib/lab/cloudTextures'

import type { RoomDefinition } from './types'

/**
 * Publications —— 城市屋顶的晾衣绳，论文卡挂在上面。
 *
 * **本仓库唯一取景与环境都正确的房间**，因此它是另外三间的参照，而不是被
 * 修的对象。它之所以对，是因为它有一个专门的
 * `usePublicationBrowseCamera`——进房后把相机移到晾衣绳轴线上、看向纸的中点。
 * 这份 `entryPose` 就是把那个 hook 里的常量搬成声明
 * （`PUBLICATION_CARD_MOTION.cameraFrame.browseDistance / browseLookAt`），
 * 让四个房间用同一套机制而不是一个房间一套。
 */
export const publicationsRoom: RoomDefinition = {
  id: 'publications',
  doorSlot: 2,
  labelKey: 'publications',

  entryPose: {
    // 晾衣绳 group 在 scenery 局部 [0, 1.6, −4]，scenery 又在房间局部
    // [0, −0.7, −2]；browseLookAt 是绳中心、纸的中段高度
    position: [0, 0.9, -1],
    target: [0, 1.6, -6],
    duration: 0.7,
  },

  // 横向浏览靠转盘（dockMachine），相机只需很小的余量
  cameraFreedom: {
    azimuth: [-0.25, 0.25],
    polar: [-0.12, 0.12],
    distance: [4, 6],
  },

  // 屋顶远景（城市剪影）靠自己的天空球，不用距离雾
  fog: null,

  ambience: {
    soundId: 'amb_publications',
    position: [0, 0, -12],
    refDistance: 3,
    rolloffFactor: 1.0,
  },

  assets: [
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

  tutorial: 'publications_read',
  view: () =>
    import('@/components/rooms/publications/PublicationsRoomView').then(m => ({
      default: m.PublicationsRoomView,
    })),
}
