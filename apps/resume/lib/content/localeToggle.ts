import type { Locale } from './types'

/**
 * 语言切换按钮上显示什么。
 *
 * 规则：显示**目标**语言的名字，用目标语言写——英文界面上是「中文」，中文界面上
 * 是「EN」。理由是看不懂当前语言的用户要能认出这个按钮是给自己的。
 *
 * 抽成纯函数是因为现在有两处按钮（Classic / 入口页的 `LocaleToggle`，Lab 顶栏的
 * `NavigationUI`），两处若各写一个三目，改一处忘一处就会出现"一边写 中文 一边
 * 写 ZH"的不一致。
 */
export function nextLocaleLabel(locale: Locale): string {
  return locale === 'en' ? '中文' : 'EN'
}
