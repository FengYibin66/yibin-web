import type { Locale } from '@/lib/content'

/**
 * Lab 里 3D 文字用哪个字体文件。**凡是渲染用户文案的 3D 文字，字体必须覆盖
 * 该文案可能出现的全部字符**，否则 troika 会去外部 CDN（默认 jsDelivr）取兜底字体
 * ——大陆访客那里是**一片空白**，而开发机上永远成功。属于本地看不见的失败。
 *
 * 门禁 `__tests__/labFonts.test.ts` 全禁写死路径。
 */

/** 拉丁手写体（标题 / 强调）。无汉字字形 */
export const LAB_FONT_LATIN_BOLD = '/fonts/CabinSketch-Bold.ttf'
/** 拉丁手写体（正文） */
export const LAB_FONT_LATIN_REGULAR = '/fonts/CabinSketch-Regular.ttf'
/** 中文手写体。CJK 文案一律用它 */
export const LAB_FONT_CJK = '/fonts/ZCOOLKuaiLe-Regular.ttf'

export interface LabFonts {
  /** 标题 / 强调（按语言是汉字体或拉丁体） */
  bold: string
  /** 正文（摘要、关键词） */
  regular: string
  /** 始终是拉丁手写体。给确定不含汉字的内容用：会议名、DOI、`ENTER →` */
  latinBold: string
}

export function getLabFonts(locale: Locale): LabFonts {
  if (locale === 'zh') {
    return {
      bold: LAB_FONT_CJK,
      regular: LAB_FONT_CJK,
      latinBold: LAB_FONT_LATIN_BOLD,
    }
  }

  return {
    bold: LAB_FONT_LATIN_BOLD,
    regular: LAB_FONT_LATIN_REGULAR,
    latinBold: LAB_FONT_LATIN_BOLD,
  }
}

/** Unicode 范围里的汉字（用于判断一段文案是否需要 CJK 字体） */
const HAN = /[㐀-䶿一-鿿豈-﫿]/

/** 一段文案是否需要 CJK 字体 */
export function needsCjkFont(text: string): boolean {
  return HAN.test(text)
}

/**
 * **按文案的实际内容**选字体——3D 文字用的就是这个函数，不要按 locale 选。
 *
 * 按 locale 选有两个问题：会把 zh 下的拉丁文案（`YIBIN FENG`、`CSCW 2025`）
 * 也换成 CJK 体；而 locale 也不等于文案语言（`zh` 的 `roles` 全是英文）。
 * 真正决定要不要 CJK 字形的是**这一段字符串本身**。
 *
 * @param text 实际渲染的那个字符串，不要传占位符
 * @param latinFace 纯拉丁时用哪款（`LAB_FONT_*` 之一）
 */
export function fontForText(text: string, latinFace: string): string {
  return needsCjkFont(text) ? LAB_FONT_CJK : latinFace
}

/** 展示用的手写体（About 的大标题）。无汉字字形 */
export const LAB_FONT_DISPLAY = '/fonts/RubikScribble-Regular.ttf'
