import { lazy, type LazyExoticComponent } from 'react'

import type { RoomId } from '@/lib/lab/domain/ids'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * roomId → 房间视图组件。**这是 `RoomInterior` 唯一的分发处。**
 *
 * ## 为什么在 `components/` 而不在 domain 里
 *
 * `RoomDefinition` 原先有一个 `view: () => Promise<{ default: ComponentType }>`
 * 字段，于是 `lib/lab/domain/rooms/types.ts` 要 `import type { ComponentType }
 * from 'react'`，而五个房间定义各自 `import('@/components/rooms/...')`
 * ——**domain 指向 interface 层**，与「依赖方向单向朝内」正好反着
 * （根 CLAUDE.md 的「分层」，以及 `apps/resume/AGENTS.md` 声称的
 * 「domain 不感知 React / three / DOM」）。
 *
 * 房间**是什么**（门位、取景、雾、环境音、资产、教程）属于 domain；房间**长什么样**
 * 属于 interface 层。把 `view` 搬到这里之后 domain 不再感知 React。
 *
 * ## 为什么是 `lazy` 而不是静态 import
 *
 * 四个房间各自带着自己的纹理与几何。静态 import 会把它们全部塞进 Lab 的首屏
 * chunk——而访客一次只进一间房。
 *
 * ## 加一个房间要改哪些地方
 *
 * `ROOM_IDS`（domain/ids）、`CORRIDOR_DOORS`（domain/corridor/layout）、
 * `domain/rooms/<id>.ts`、`domain/rooms/index.ts`、本文件、`content` 的门牌文案。
 * 六处，其中前四处是 domain 的事实声明，本文件是唯一的视图接线点
 * ——**不再需要动 `RoomInterior`**（那是这次接线的收益）。
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
  /*
    Gallery 走独立路由（`/gallery`），它的视图是一个执行 `router.push` 的空组件。

    有了它，编排代码里那些 `if (roomId === 'gallery')` 的特例分支就没有存在的
    理由了——它的 `entryPose` 照常生效（相机对齐门），只是"房间内容"是一次导航。
  */
  gallery: lazy(() =>
    import('@/components/rooms/GalleryDoorView').then(m => ({ default: m.GalleryDoorView }))),
}
