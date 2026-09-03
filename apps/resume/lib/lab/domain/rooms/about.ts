import { CLOUD_TEXTURES } from '@/lib/lab/cloudTextures'

import type { RoomDefinition } from './types'

/**
 * About —— 天空里的故事线，滚动"飞过"三个里程碑。
 *
 * 修的是审计 A1：进门时名字、职位、头像、简介全部挤在约 200px 宽、几乎不可
 * 读，天空背景也看不见，房间读成一片米色虚空。两个原因叠加：
 *
 * 1. 故事内容在房间局部 z ≈ −15，而进门后相机停在约 30 单位外——设计意图是
 *    "滚动飞向"，但前几秒什么都看不清，用户不知道要滚
 * 2. 走廊的 `fog(#f0ece4, 15, 60)` 挂在 Canvas 根上，15 单位外开始洗白，正好
 *    是内容所在的距离
 *
 * 所以给它一个"已经飞到第一个里程碑前"的 entryPose，并换成自己的浅蓝天空雾
 * （远端 fog 是天空该有的效果，不是要去掉）。
 */
export const aboutRoom: RoomDefinition = {
  id: 'about',
  doorSlot: 0,
  labelKey: 'about',

  entryPose: {
    // IntroMilestone 在房间局部 z = −15，内容纵向跨 y 0..5、横向 ±5
    position: [0, 2.2, -3],
    target: [0, 2.4, -15],
    duration: 1.2,
  },

  // 允许小幅环视：天空是开阔场景，锁死会显得死板；但不允许转身看向身后
  // （身后是走廊入口方向，那里被 CORRIDOR_CLIP_Z 裁掉了，什么都没有）
  cameraFreedom: {
    azimuth: [-0.35, 0.35],
    polar: [-0.2, 0.25],
    distance: [10, 16],
  },

  // 自己的天空雾：浅蓝、远端起雾，让云层有纵深；不是走廊那种 15 单位就洗白的米白
  fog: { color: '#d4e8f5', near: 60, far: 220 },

  ambience: {
    soundId: 'amb_about',
    position: [0, 2, -12],
    refDistance: 2,
    rolloffFactor: 0.8,
  },

  assets: [
    '/textures/about/awatarnachmurce.webp',
    '/textures/about/uowyspa.webp',
    '/textures/about/freelancewyspa.webp',
    ...CLOUD_TEXTURES,
  ],

  tutorial: 'about_scroll',
  view: () => import('@/components/rooms/AboutRoomView').then(m => ({ default: m.AboutRoomView })),
}
