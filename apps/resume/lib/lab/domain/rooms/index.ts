import { ROOM_IDS, type RoomId } from '../ids'
import { aboutRoom } from './about'
import { contactRoom } from './contact'
import { galleryRoom } from './gallery'
import { projectsRoom } from './projects'
import { publicationsRoom } from './publications'
import type { RoomDefinition } from './types'

/**
 * 房间注册表 —— 唯一来源（ADR 20260903140615）。
 *
 * **加一个房间 = 加一个文件 + 在这里登记一行**，不改任何编排代码。
 * 预载表由 `assets` 字段派生（`lib/lab/app/assets/manifest.ts`，生成物）。
 */
export const ROOMS: Readonly<Record<RoomId, RoomDefinition>> = {
  about: aboutRoom,
  projects: projectsRoom,
  publications: publicationsRoom,
  gallery: galleryRoom,
  contact: contactRoom,
}

/** 按走廊里的门位顺序（= 访客沿走廊走过去的顺序） */
export const ROOMS_IN_CORRIDOR_ORDER: readonly RoomDefinition[] = ROOM_IDS
  .map(id => ROOMS[id])
  .slice()
  .sort((a, b) => a.doorSlot - b.doorSlot)

export function roomById(id: RoomId): RoomDefinition {
  return ROOMS[id]
}

/**
 * 会在 Canvas 内挂载 3D 内容的房间。
 * Gallery 不在其中——它是一个跳转到独立路由的门（见 `gallery.ts`）。
 */
export function inCanvasRooms(): readonly RoomDefinition[] {
  return ROOMS_IN_CORRIDOR_ORDER.filter(room => room.assets.length > 0)
}

export type { RoomDefinition, RoomViewProps, RoomEntryPose, RoomFog, RoomAmbience, RoomCameraFreedom, Vec3 } from './types'
export { aboutRoom, contactRoom, galleryRoom, projectsRoom, publicationsRoom }
