'use client'

import { LocaleToggle } from '@/components/ui/LocaleToggle'

/**
 * 门户页（`/`）右上角的语言切换。
 *
 * 门户是全站唯一的入口：语言在这里定，进 Lab 或 Classic 都沿用（三处共用
 * `localStorage.resume-locale`）。此前门户只**读**语言没有切换入口，用户得先进
 * Classic 再在 Navbar 里切——入口页上做不了的选择，等于没有入口。
 *
 * 这里不重写按钮，只包一层稳定的标识：同一个组件、同一个 `data-testid`、
 * 同一套文字规则（`nextLocaleLabel`）。
 *
 * **定位不在这里。** 它由 `EdgeItem id="entry-locale"` 放进 `top-right` 槽位
 * （ADR 20260909182319）。原先本组件自己写 `fixed; top:16; right:16; z:40`，
 * 而屏角是无主的共享资源——那正是入口页底部提示盖住主按钮、域名水印被完全盖住
 * 那一类缺陷的成因。
 *
 * `data-entry-locale-toggle` 必须保留：`scripts/media/entry-firstframe.mjs` 截
 * `/` 的手机端静态首帧时靠它把不属于"那扇门"的 UI 藏掉。靠内联样式匹配太脆。
 */
export function EntryLocaleToggle() {
  return (
    <div data-entry-locale-toggle="">
      <LocaleToggle />
    </div>
  )
}
