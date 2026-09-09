import { lazy, type LazyExoticComponent } from 'react'

import type { RoomId } from '@/lib/lab/domain/ids'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * roomId → 房间视图组件。**`RoomInterior` 唯一的分发处。**
 *
 * 在 `components/` 而不在 domain：房间**是什么**（门位、取景、雾、音、资产、教程）
 * 属于 domain，房间**长什么样**属于 interface 层。放 domain 会让它 import React，
 * 依赖方向就反了。
 *
 * `lazy` 而非静态 import：四个房间各带纹理与几何，访客一次只进一间。
 *
 * 加一个房间要改六处：`ROOM_IDS`、`CORRIDOR_DOORS`、`domain/rooms/<id>.ts`、
 * `domain/rooms/index.ts`、本文件、`content` 的门牌文案。不需要动 `RoomInterior`。
 */
export const ROOM_VIEWS: Readonly<
  Record<RoomId, LazyExoticComponent<React.ComponentType<RoomViewProps>>>
> = {
  about: lazy(() =>
    import('@/components/rooms/AboutRoomView').then(m => ({ default: m.AboutRoomView }))),
  projects: lazy(() =>
    import('@/components/rooms/projects/ProjectsRoomView').then(m => ({
      default: m.ProjectsRoomView,
    }))),
  publications: lazy(() =>
    import('@/components/rooms/publications/PublicationsRoomView').then(m => ({
      default: m.PublicationsRoomView,
    }))),
  contact: lazy(() =>
    import('@/components/rooms/ContactRoomView').then(m => ({ default: m.ContactRoomView }))),
  // Gallery 走独立路由，视图是一个执行 `router.push` 的空组件——
  // 这样编排代码里不需要 `if (roomId === 'gallery')` 的特例

  gallery: lazy(() =>
    import('@/components/rooms/GalleryDoorView').then(m => ({ default: m.GalleryDoorView }))),
}
