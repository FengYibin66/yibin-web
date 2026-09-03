import type { Locale } from '@/lib/content'
import {
  LAB_FONT_CJK,
  LAB_FONT_LATIN_BOLD,
  LAB_FONT_LATIN_REGULAR,
  getLabFonts,
  type LabFonts,
} from '@/lib/lab/domain/labFonts'

/**
 * Publications 卡片的字体 —— 现在只是 `lib/lab/domain/labFonts` 的转发。
 *
 * 这里原本自己实现了一遍「zh 换 ZCOOLKuaiLe」的逻辑，而走廊门牌那边写死了
 * CabinSketch（无汉字字形）。同一条知识两份实现、其中一份漏了，正是中文门牌
 * 在大陆变空白的原因（troika 缺字时会去 jsDelivr 取兜底字体）。
 *
 * 保留这个文件是为了不改动 Publications 那一堆调用点；语义与命名都在
 * `labFonts` 里。新代码直接用 `getLabFonts`。
 */

/** @deprecated 用 `LAB_FONT_LATIN_BOLD` */
export const PUBLICATION_FONT_EN_BOLD = LAB_FONT_LATIN_BOLD
/** @deprecated 用 `LAB_FONT_LATIN_REGULAR` */
export const PUBLICATION_FONT_EN_REGULAR = LAB_FONT_LATIN_REGULAR
/** @deprecated 用 `LAB_FONT_CJK` */
export const PUBLICATION_FONT_ZH = LAB_FONT_CJK

export type PublicationFonts = LabFonts

export function getPublicationFonts(locale: Locale): PublicationFonts {
  return getLabFonts(locale)
}
