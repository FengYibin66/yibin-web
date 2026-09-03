/**
 * Lab 的标识符类型 —— domain 层的最内圈。
 *
 * 放在这里而不是 `context/SceneContext.tsx` 的原因：domain 层不能 import
 * React / three（ADR 20260903140615 的分层约定），而 `RoomId` 是走廊布局、
 * 房间注册表、成就定义、状态机全都要用的类型。原先它从一个 React Context
 * 文件导出，任何想用它的纯逻辑模块都被迫拖进 React。
 *
 * `SceneContext` 现在从本文件 re-export，迁移期内既有 import 路径不受影响。
 */

export const ROOM_IDS = ['about', 'projects', 'publications', 'gallery', 'contact'] as const
export type RoomId = (typeof ROOM_IDS)[number]

/** 走廊里每段有 5 个门位，slot 是它在段内的序号 */
export const DOOR_SLOTS = [0, 1, 2, 3, 4] as const
export type DoorSlot = (typeof DOOR_SLOTS)[number]

export type WallSide = 'left' | 'right'

/**
 * 门贴图的类型后缀，对应 `/textures/corridor/doors/drzwi<type>.webp`。
 * 名字是波兰语（素材来自 itomdev 原版），刻意不改——改了要重命名文件。
 * 注意 `kontakt` 被 publications 与 contact 两扇门共用。
 */
export const DOOR_TEXTURE_TYPES = ['about', 'projekty', 'kontakt', 'social'] as const
export type DoorTextureType = (typeof DOOR_TEXTURE_TYPES)[number]

export const ACHIEVEMENT_IDS = [
  'corridor_enter',
  'corridor_explore',
  'about_scroll',
  'projects_inspect',
  'gallery_inspect',
  'contact_found',
  'publications_read',
] as const
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

/**
 * 入门提示，**不是可收集的成就**。
 *
 * `corridor_enter`（"点一扇门进去"）刻意不持久化——它是每次访问都该出现的
 * 提示（见 `lib/lab/achievementStorage` 的 `NEVER_PERSISTED`）。
 *
 * 提出来放在 domain 是因为这件事原先只有存储层知道：成就面板把它**列在
 * 清单里**却**不计入总数**，于是显示"0 / 6"而下面有 7 行，完成它数字也不动。
 * 「不计入」和「不展示」必须同一个来源。
 */
export const HINT_ONLY_ACHIEVEMENTS: readonly AchievementId[] = ['corridor_enter']

/** 可收集的成就（面板列出、计入总数的那些） */
export const COLLECTABLE_ACHIEVEMENT_IDS = ACHIEVEMENT_IDS
  .filter(id => !HINT_ONLY_ACHIEVEMENTS.includes(id))

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === 'string' && (ROOM_IDS as readonly string[]).includes(value)
}

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(value)
}
