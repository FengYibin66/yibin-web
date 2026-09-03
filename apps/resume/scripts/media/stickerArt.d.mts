/**
 * `stickerArt.mjs` 的类型声明。理由同 `galleryDoorPlan.d.mts`：
 * 生成脚本要 Node 直接跑，测试要断言同一份画法，所以源文件是 `.mjs`；
 * 类型在这里补。
 */
import type { StickerKind, StickerViewBox } from '@/lib/lab/domain/galleryDoorPlan.mjs'

export interface StickerArt {
  viewBox: StickerViewBox
  body: (seed: number) => string
}

export const STICKER_ART: Record<StickerKind, StickerArt>
