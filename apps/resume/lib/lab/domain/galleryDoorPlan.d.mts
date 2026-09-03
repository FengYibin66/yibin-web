/**
 * `galleryDoorPlan.mjs` 的类型声明。
 *
 * 那个文件是 `.mjs` 而不是 `.ts`，因为生成脚本（`scripts/media/gallery-door.mjs`）
 * 是 Node 直接跑的、不经过打包，而测试要断言**同一份**声明。两边都能 import
 * 的最省事形态就是 `.mjs`。
 *
 * 代价是没有类型，索引访问（`STICKER_VIEWBOXES[patch.kind]`）在 TS 里就是
 * `any`/报错。这份 `.d.mts` 把类型补回来，所以"能被 Node 直接跑"与"类型完整"
 * 两件事都成立。
 */

export interface StickerViewBox {
  width: number
  height: number
}

export type StickerKind =
  | 'camera'
  | 'film'
  | 'polaroid'
  | 'aperture'
  | 'lens'
  | 'tape'
  | 'contactSheet'
  | 'filmStripVertical'
  | 'photoStrip'

export const STICKER_VIEWBOXES: Record<StickerKind, StickerViewBox>

export interface DoorRegion {
  left: number
  top: number
  width: number
  height: number
}

export interface DoorPatch {
  kind: StickerKind
  region: DoorRegion
  rotate?: number
}

export interface DoorPlan {
  id: string
  /** 产物目录，相对 `public/textures/` */
  dir: string
  bounds: { width: number; height: number }
  patches: DoorPatch[]
}

export const DOOR_PLANS: DoorPlan[]

export function coverSize(
  viewBox: StickerViewBox,
  region: DoorRegion,
  options?: number | { rotate?: number; margin?: number },
): { width: number; height: number }
