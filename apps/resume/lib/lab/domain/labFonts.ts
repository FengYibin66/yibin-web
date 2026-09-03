import type { Locale } from '@/lib/content'

/**
 * Lab 里 3D 文字用哪个字体文件 —— 按语言选。
 *
 * ## 为什么这件事需要一处唯一来源
 *
 * drei 的 `<Text>`（底层 troika）要的是一个**字体文件 URL**，不是 CSS 族名。
 * 于是每处 3D 文字都得自己写死一个路径，而「中文该换字体」这条知识就散落各处。
 * 走廊门牌就是这么漏的：它写死 `CabinSketch-Bold.ttf`，而 CabinSketch **没有汉字
 * 字形**。
 *
 * ## 漏掉的后果不是"字丑一点"
 *
 * troika 遇到字体覆盖不到的字符时会去一个**外部 CDN** 取兜底字体：默认
 * `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data`
 * （见 `troika-three-text` 的 `unicodeFontsURL` 默认值）。所以中文门牌的实际表现是：
 *
 * - 能连上 jsDelivr 时 → 渲染成 Noto Sans（黑体），与 Publications 卡片的手写体不统一
 * - **连不上时（大陆访客）→ 五扇门的门牌全是空白**
 *
 * 而门牌是走廊里最先被看到、也是唯一说明"这扇门后面是什么"的信息。
 *
 * 这与审计 E8（鸭子对话框漏 `font` 属性 → 去 fonts.gstatic.com 拉字体 → 大陆加载
 * 失败）是**同一类问题在同一次重构里复发**。E8 的修法是"补上 font 属性"，治的是
 * 症状；这里治的是根因：让"按语言选字体"只有一处实现，任何 3D 文字都从这里取。
 *
 * ## 判定原则
 *
 * **凡是渲染用户文案的 3D 文字，字体必须覆盖该文案可能出现的全部字符。**
 * 覆盖不到时的兜底路径是一次跨境网络请求，它在开发机上永远成功、在目标用户那里
 * 未必——属于"本地看不见的失败"。
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
  /**
   * 始终是拉丁手写体。
   *
   * 给确定不含汉字的内容用：会议名、DOI、`ENTER →` 这类。中文语境下也保持
   * CabinSketch，因为那些字符串本身就是拉丁的，换成 ZCOOL 反而不统一。
   */
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
 * **按文案的实际内容**选字体 —— 3D 文字应该用的就是这个函数。
 *
 * ## 为什么不是按 locale 选
 *
 * 按 locale 选（`getLabFonts(locale).bold`）有两个问题：
 *
 * 1. **会换掉不该换的字体。** Lab 里不止一款拉丁手写体：大标题用 RubikScribble、
 *    正文用 CabinSketch。按 locale 一刀切成 CJK 体，会把 zh 下所有拉丁文案
 *    （`YIBIN FENG`、`NUS 2023-2024`、`CSCW 2025`）的字形也一起改掉。
 * 2. **locale 不等于文案语言。** `zh` 的 `roles` 全是英文
 *    （`AI Research Engineer`），而作者名里可能有汉字。真正决定"要不要 CJK
 *    字形"的是**这一段字符串本身**，不是界面语言。
 *
 * 所以判据是文案内容：含汉字 → CJK 体；否则保留调用方本来想要的那款拉丁体。
 *
 * ## 为什么这件事值得一个函数
 *
 * troika 缺字时会去外部 CDN 取兜底字体（默认 jsDelivr），所以"字体选错"的后果是
 * **大陆访客看到空白**，不是"字丑一点"。而受影响的远不止门牌——加上这道门禁后
 * 实测扫出 14 处写死路径，其中 `zh` 的 `tagline`
 * （`构建能够理解并影响人类行为的智能系统。…`）、`journeyTitle`（`旅程`）、
 * `journeySubtitle`（`教育与经历`）都在用拉丁体渲染：**About 房间的中文文案
 * 一直在走外网兜底**。审计只记了门牌那一处（E8 的同类复发），实际是全站性的。
 *
 * @param text 要渲染的文案。传实际渲染的那个字符串，不要传占位符
 * @param latinFace 文案是纯拉丁时用哪款（`LAB_FONT_*` 之一）
 */
export function fontForText(text: string, latinFace: string): string {
  return needsCjkFont(text) ? LAB_FONT_CJK : latinFace
}

/** 展示用的手写体（About 的大标题）。无汉字字形 */
export const LAB_FONT_DISPLAY = '/fonts/RubikScribble-Regular.ttf'
