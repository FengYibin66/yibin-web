import type { RoomDefinition } from './types'

/**
 * Gallery —— 唯一一个"房间"其实是独立路由的门。
 *
 * 它存在的意义是**让 Gallery 不再是编排代码里的特例**。原先
 * `DoorSection`、`RoomInterior`、`TeleportRoom`、`roomAssets` 里各有一处
 * `if (roomId === 'gallery')` 分支，而这些分支正是审计 D1 的土壤：
 * `components/rooms/GalleryRoom.tsx`（3D 版画廊）被特例分支绕过后成了**零渲染方
 * 的死代码**，而 `gallery_inspect` 成就的唯一解锁调用就在那个文件里——
 * 于是"Art Critic"永远解不开，且没有任何东西能发现。
 *
 * 现在它是一个正常的 `RoomDefinition`：`entryPose` 照常让相机对齐门（那段
 * 动画是有意义的，跳转前的取景），`view` 是一个执行 `router.push` 的组件。
 * 没有 `assets`（照片由 `/gallery` 路由自己按需加载），没有 `ambience`，
 * 没有 `tutorial`（成就由路由侧的模块级存储记录）。
 */
export const galleryRoom: RoomDefinition = {
  id: 'gallery',
  doorSlot: 3,
  labelKey: 'gallery',

  // 只对齐门、不进房：相机停在门前，动画结束即跳转
  entryPose: {
    position: [0, 0, 0],
    target: [0, 0, -1],
    duration: 0,
  },
  cameraFreedom: null,
  fog: null,
  ambience: null,
  assets: [],
  tutorial: null,

}
