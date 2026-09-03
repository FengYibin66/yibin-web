import { DOOR_TEXTURE_TYPES, type DoorTextureType } from '../ids'
import { CORRIDOR_DOORS } from './layout'

/**
 * 走廊里**由规则算出来**的纹理组。
 *
 * 为什么要单独声明：这些路径在组件里是模板字面量
 * （`` `/textures/corridor/avatar_anim/${i + 1}.webp` ``、
 * `` `/textures/corridor/doors/drzwi${type}.webp` ``），静态扫描抓不到。
 * 生成器 `scripts/lab/gen-asset-manifest.mjs` 只能收字面量，于是第一版跑出来
 * 的走廊清单少了 33 张图——而"少预载"的表现不是报错，是走廊走到一半突然
 * 闪空（那张图开始 suspend）。
 *
 * 所以规则本身放在 domain 里用类型表达，生成物只做拼接。
 * `__tests__/roomRegistry.test.ts` 断言这里算出的每个文件真实存在。
 */

/** 头像挥手动画的帧数（`Avatar.tsx` 的 TOTAL_FRAMES） */
export const AVATAR_ANIM_FRAME_COUNT = 9

export const AVATAR_ANIM_FRAMES: readonly string[] = Array.from(
  { length: AVATAR_ANIM_FRAME_COUNT },
  (_, i) => `/textures/corridor/avatar_anim/${i + 1}.webp`,
)

/**
 * 每种门贴图有 sketch 与 painted 两层（hover 时经 RevealMaterial 从线稿
 * 渐变成彩铅）。**两层都必须预载**——只载 sketch 的话第一次 hover 会闪。
 */
export function doorTextureFiles(type: DoorTextureType): readonly string[] {
  return [
    `/textures/corridor/doors/drzwi${type}.webp`,
    `/textures/corridor/doors/drzwi${type}_painted.webp`,
  ]
}

/**
 * 走廊里实际用到的门贴图。
 *
 * 取自 `CORRIDOR_DOORS` 而不是 `DOOR_TEXTURE_TYPES` 全集——两者当前恰好
 * 一致（4 种类型都被用到，其中 `kontakt` 被 publications 与 contact 共用），
 * 但将来若加了一种类型却没有门用它，全集会白载两张图。
 */
export const USED_DOOR_TEXTURE_TYPES: readonly DoorTextureType[] = [
  ...new Set(CORRIDOR_DOORS.map(door => door.textureType)),
]

export const DOOR_TEXTURES: readonly string[] = USED_DOOR_TEXTURE_TYPES.flatMap(doorTextureFiles)

/** 声明了但没有门在用的贴图类型 —— 有的话说明清单有冗余 */
export function unusedDoorTextureTypes(): readonly DoorTextureType[] {
  const used = new Set(USED_DOOR_TEXTURE_TYPES)
  return DOOR_TEXTURE_TYPES.filter(type => !used.has(type))
}

/** 全部由规则算出的走廊纹理 */
export const DERIVED_CORRIDOR_TEXTURES: readonly string[] = [
  ...AVATAR_ANIM_FRAMES,
  ...DOOR_TEXTURES,
]
