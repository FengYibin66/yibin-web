import { CLOUD_TEXTURES } from '@/lib/lab/cloudTextures'

import type { RoomDefinition } from './types'

/**
 * Contact —— 海边码头，四个社交桶 + 一张留言纸。
 *
 * 修的是审计 A3：**留言纸是这个房间唯一的 CTA，而它在初始取景外**——码头在
 * 左下角被切掉，房间内又没有任何相机控制，用户根本看不到它。MESSAGE 桶的
 * `focusMessage()`（止血批修的那个空 onClick）聚焦到的是一张看不见的纸。
 *
 * entryPose 把相机放在码头上方偏后，看向留言纸，四个桶与远处的灯塔/船落在
 * 背景里。`fog: null` —— 海景本身靠纹理表达纵深，走廊的距离雾只会把远处的
 * 灯塔和船洗成白色。
 */
export const contactRoom: RoomDefinition = {
  id: 'contact',
  doorSlot: 4,
  labelKey: 'contact',

  entryPose: {
    // MessagePaper 在房间局部 [0, 0.07, 2]；码头 [0, 0.05, 1.8]
    // 相机站在纸的后上方，视线略微俯下
    position: [0, 1.35, 5.6],
    target: [0, 0.05, 1.4],
    duration: 1.1,
  },

  // 允许小幅环视看四个桶（它们分布在 x ±5、z −7..−10），但不允许拉远到看不清纸
  cameraFreedom: {
    azimuth: [-0.45, 0.45],
    polar: [-0.15, 0.3],
    distance: [3.5, 6.5],
  },

  // 海景不要距离雾：远处的灯塔与帆船是构图的一部分，洗白就没了
  fog: null,

  ambience: {
    soundId: 'amb_contact',
    position: [0, 0, -8],
    refDistance: 2,
    rolloffFactor: 1.2,
  },

  assets: [
    '/textures/contact/faletopdown.webp',
    '/textures/contact/molo.webp',
    '/textures/contact/latarnia.webp',
    '/textures/contact/statek.webp',
    '/textures/contact/beczka.webp',
    '/textures/contact/beczka_painted.webp',
    '/textures/contact/paper_form.webp',
    '/textures/contact/send_button.webp',
    // 漏收这批就是审计 A2：云退化成四个无贴图的灰矩形
    ...CLOUD_TEXTURES,
  ],

  tutorial: 'contact_found',
  view: () =>
    import('@/components/rooms/ContactRoomView').then(m => ({ default: m.ContactRoomView })),
}
