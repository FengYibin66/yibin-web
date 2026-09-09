import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Navbar } from '@/components/layout/Navbar'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { content } from '@/lib/content'

/**
 * 窄屏导航菜单（ADR 20260909182319 第三批）。
 *
 * ## 守的是哪个缺陷类
 *
 * 不是「菜单能开能关」——那是实现细节。守的是
 * **「宽屏有的入口，窄屏必须也到得了」**：改动前 `<768` 下那 9 个导航入口是
 * `hidden md:flex`，藏起来了而**没有任何替代入口**，而 `/classic/` 在 390px 上
 * 高 18056px。这类缺陷的症状是"功能在某一档消失"，而 DOM 里元素还在
 * （只是 `display: none`），所以按 `getByText` 断言"链接存在"会全绿。
 *
 * 因此下面那条对账断言比"菜单能开"重要得多：有人加第 10 个宽屏链接却忘了
 * 菜单，它会红。
 *
 * ## jsdom 不算 CSS，所以这里测不了「哪一档可见」
 *
 * `hidden md:flex` / `md:hidden` 在 jsdom 里没有效果——两组都在 DOM 里。
 * 所以本文件测的是**结构与行为**（菜单里有没有那些入口、开关与收起是否接线），
 * "哪一档真的看得见、点得到" 由 `e2e/staticExport.spec.ts` 在 390px 的
 * mobile-safari 形态下量渲染结果。两层各守一半，缺任一层都会漏。
 */

describe('窄屏导航菜单', () => {
  it('默认收起，面板不在 DOM 里', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    expect(screen.queryByTestId('navbar-menu')).toBeNull()
    expect(screen.getByTestId('navbar-menu-toggle')).toHaveAttribute('aria-expanded', 'false')
  })

  it('菜单里的入口与宽屏那一排逐条对账（这条是本文件的主张）', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('navbar-menu-toggle'))

    const panel = screen.getByTestId('navbar-menu')
    const inMenu = within(panel).getAllByRole('link').map(a => a.getAttribute('href'))

    // 宽屏那一排的期望来自内容数据，不是抄一份写死的清单——
    // 抄一份的话，加了链接而两边都忘改时它照样绿。
    const expected = [...content.en.nav.links.map(l => l.href), '/gallery']

    expect(inMenu).toEqual(expected)
    expect(inMenu.length).toBe(9)   // 8 个锚点 + Gallery，改动前这 9 个在窄屏全无入口
  })

  it('aria 接线：expanded 跟着状态变，toggle 指向面板', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    const toggle = screen.getByTestId('navbar-menu-toggle')
    expect(toggle).toHaveAttribute('aria-controls', 'navbar-menu')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('navbar-menu')).toHaveAttribute('id', 'navbar-menu')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('点菜单里的链接会收起（否则跳到锚点后菜单还盖在上面）', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('navbar-menu-toggle'))
    const panel = screen.getByTestId('navbar-menu')
    fireEvent.click(within(panel).getAllByRole('link')[0]!)
    expect(screen.queryByTestId('navbar-menu')).toBeNull()
  })

  it('ESC 收起', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('navbar-menu-toggle'))
    expect(screen.getByTestId('navbar-menu')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('navbar-menu')).toBeNull()
  })

  it('滚动收起（菜单钉在顶栏上，这一页有 18056px 可滑）', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('navbar-menu-toggle'))
    fireEvent.scroll(window)
    expect(screen.queryByTestId('navbar-menu')).toBeNull()
  })

  it('无障碍名随语言变，且开合两态不同（不是同一句话）', () => {
    render(<Navbar />, { wrapper: LocaleProvider })
    const toggle = screen.getByTestId('navbar-menu-toggle')
    const closed = toggle.getAttribute('aria-label')
    fireEvent.click(toggle)
    const opened = toggle.getAttribute('aria-label')
    expect(closed).toBe(content.en.nav.menu)
    expect(opened).toBe(content.en.nav.closeMenu)
    expect(closed).not.toBe(opened)
  })
})
