import { fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { beforeEach, describe, expect, it } from 'vitest'

import { EntryLocaleToggle } from '@/components/entry/EntryLocaleToggle'
import { nextLocaleLabel } from '@/lib/content/localeToggle'

/**
 * 门户页（`/`，左 Lab 右 Classic 那一屏）的语言切换（2026-09-04）。
 *
 * 门户是全站唯一的入口，语言该在这里定、进 Lab 或 Classic 都沿用。此前它只**读**
 * 语言（`ClassicPanel` 按 locale 取 hero），没有任何切换入口——用户得先进 Classic
 * 再在 Navbar 里切。
 *
 * 组件本身只是把 `LocaleToggle` 固定到右上角并挂一个稳定的 data 属性；这里测的是
 * 它确实用的是那一个按钮（同一个 `data-testid`、同一套文字规则），以及切换真的写进
 * 全站共享的那份偏好。
 */
describe('门户页语言切换', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('用的是全站同一个 LocaleToggle（同一个 testid、同一套文字）', () => {
    render(<EntryLocaleToggle />, { wrapper: LocaleProvider })
    expect(screen.getByTestId('locale-toggle')).toHaveTextContent(nextLocaleLabel('en'))
  })

  it('点一下写进 resume-locale 并切 <html lang> —— Lab 与 Classic 读的就是这一份', () => {
    render(<EntryLocaleToggle />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('locale-toggle'))
    expect(window.localStorage.getItem('resume-locale')).toBe('zh')
    expect(document.documentElement.lang).toBe('zh')
    expect(screen.getByTestId('locale-toggle')).toHaveTextContent(nextLocaleLabel('zh'))
  })

  it('带稳定的 data 属性 —— 手机端静态首帧截图脚本要靠它把按钮藏掉', () => {
    /*
      `scripts/media/entry-firstframe.mjs` 截 `/` 的首帧当手机端占位图。它靠
      `[data-explorer-bar]` 藏掉底部提示条；这个按钮同理——没有稳定把手，
      按钮会被烤进静态图里，而且那张图只有手机端才显示，桌面开发看不见。
    */
    render(<EntryLocaleToggle />, { wrapper: LocaleProvider })
    expect(document.querySelector('[data-entry-locale-toggle]')).not.toBeNull()
  })
})
