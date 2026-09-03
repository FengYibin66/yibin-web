import type { AchievementId, RoomId } from '../ids'

/**
 * 成就定义 —— 唯一来源。
 *
 * 与原先 `context/AchievementsContext.tsx` 里那份内联表的两处差别：
 *
 * 1. **文案改为 i18n key**，不再内嵌英文字符串。原先 Lab 的全部 DOM 文案都
 *    是硬编码英文，中文用户进 Lab 看到的是"门牌、地图、加载提示、教程、成就
 *    全英文，房间内容却是中文"（审计 E7）。
 * 2. **多了 `unlockedBy`**：声明这条成就由哪个领域事件解锁。加它是因为
 *    `gallery_inspect` 的唯一解锁调用曾落在一个**零渲染方**的组件里，成就
 *    永远解不开（审计 D1），而没有任何东西能发现这件事。现在
 *    `__tests__/roomRegistry.test.ts` 断言每条成就的解锁源都真实存在。
 */

export type AchievementTrigger =
  /** 进入某房间（roomMachine 到达 entered） */
  | { kind: 'room-entered'; roomId: RoomId }
  /** 在房间内交互（房间组件显式上报） */
  | { kind: 'room-interaction'; roomId: RoomId }
  /** 走廊内滚动/滑动 */
  | { kind: 'corridor-scroll' }
  /** 独立路由 /gallery 里打开照片。**在 AchievementsProvider 之外**，
   *  所以必须走模块级存储——这正是 D1 的修法 */
  | { kind: 'gallery-route' }

export interface AchievementDefinition {
  id: AchievementId
  /** `content[locale].lab.achievements[id].title` */
  titleKey: AchievementId
  unlockedBy: AchievementTrigger
  /**
   * 是否持久化。
   *
   * `corridor_enter` 刻意为 false：它是"点门进房"的入门提示，每次访问都该
   * 出现。读与写两侧都要过滤，只过滤一侧会让它在本次会话内被当成已完成。
   */
  persisted: boolean
}

export const ACHIEVEMENT_DEFS: Readonly<Record<AchievementId, AchievementDefinition>> = {
  corridor_enter: {
    id: 'corridor_enter',
    titleKey: 'corridor_enter',
    unlockedBy: { kind: 'room-entered', roomId: 'about' }, // 任意房间，about 只是占位；见 unlockOnAnyRoomEntry
    persisted: false,
  },
  corridor_explore: {
    id: 'corridor_explore',
    titleKey: 'corridor_explore',
    unlockedBy: { kind: 'corridor-scroll' },
    persisted: true,
  },
  about_scroll: {
    id: 'about_scroll',
    titleKey: 'about_scroll',
    unlockedBy: { kind: 'room-interaction', roomId: 'about' },
    persisted: true,
  },
  projects_inspect: {
    id: 'projects_inspect',
    titleKey: 'projects_inspect',
    unlockedBy: { kind: 'room-interaction', roomId: 'projects' },
    persisted: true,
  },
  gallery_inspect: {
    id: 'gallery_inspect',
    titleKey: 'gallery_inspect',
    // 关键：解锁源是**独立路由**，不是 3D 房间。原先它被写成房间内交互，
    // 而那个房间组件零渲染方 → 成就永远 locked（审计 D1）。
    unlockedBy: { kind: 'gallery-route' },
    persisted: true,
  },
  contact_found: {
    id: 'contact_found',
    titleKey: 'contact_found',
    unlockedBy: { kind: 'room-interaction', roomId: 'contact' },
    persisted: true,
  },
  publications_read: {
    id: 'publications_read',
    titleKey: 'publications_read',
    unlockedBy: { kind: 'room-interaction', roomId: 'publications' },
    persisted: true,
  },
}

/**
 * `corridor_enter` 由**任意**房间进入解锁，不绑定某一间。
 * 单独列出来是因为 `AchievementTrigger` 的 `room-entered` 需要一个具体
 * roomId，而这条的语义是"任意"——用类型表达会让 trigger 联合类型变复杂，
 * 收益不抵成本。
 */
export const UNLOCK_ON_ANY_ROOM_ENTRY: readonly AchievementId[] = ['corridor_enter']

/** 会被写入 localStorage 的成就 */
export const PERSISTED_ACHIEVEMENTS: readonly AchievementId[] = Object.values(ACHIEVEMENT_DEFS)
  .filter(def => def.persisted)
  .map(def => def.id)
