'use client'

import { LocaleToggle } from '@/components/ui/LocaleToggle'

/**
 * 门户页（`/`）右上角的语言切换。语言在门户定，进 Lab / Classic 都沿用。
 *
 * 只包一层稳定标识，不重写按钮——逻辑与文字规则复用 `LocaleToggle`。
 * 定位由 `EdgeItem id="entry-locale"` 负责（ADR 20260909182319）。
 *
 * `data-entry-locale-toggle` 必须保留：`scripts/media/entry-firstframe.mjs`
 * 截手机端静态首帧时靠它把不属于「那扇门」的 UI 藏掉。
 */
export function EntryLocaleToggle() {
  return (
    <div data-entry-locale-toggle="">
      <LocaleToggle />
    </div>
  )
}
