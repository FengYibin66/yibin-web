'use client'

import { LocaleToggle } from '@/components/ui/LocaleToggle'

/**
 * 门户页（`/`）右上角的语言切换。
 *
 * 门户是全站唯一的入口：语言在这里定，进 Lab 或 Classic 都沿用（三处共用
 * `localStorage.resume-locale`）。此前门户只**读**语言没有切换入口，用户得先进
 * Classic 再在 Navbar 里切——入口页上做不了的选择，等于没有入口。
 *
 * 这里不重写按钮，只把 Classic 页那个 `LocaleToggle` 固定到右上角：同一个组件、
 * 同一个 `data-testid`、同一套文字规则（`nextLocaleLabel`）。
 *
 * `data-entry-locale-toggle` 是给 `scripts/media/entry-firstframe.mjs` 的：它截
 * `/` 的首帧当手机端占位图，要把不属于"那扇门"的 UI 藏掉。靠内联样式匹配太脆，
 * 底部提示条用的也是同一种做法（`data-explorer-bar`）。
 *
 * `zIndex` 要压过两块面板（Lab 面板的文案链接 z 10、分隔线 z 20），但低于
 * `ExplorerBar` 的 100 —— 它们不会重叠，只是保持层级可读。
 */
export function EntryLocaleToggle() {
  return (
    <div
      data-entry-locale-toggle=""
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 40,
      }}
    >
      <LocaleToggle />
    </div>
  )
}
