import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Navbar } from '@/components/layout/Navbar'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { content } from '@/lib/content'

/**
 * 窄屏导航菜单（ADR 20260909182319）。
 *
 * 守的是**「宽屏有的入口，窄屏必须也到得了」**，不是「菜单能开能关」。
 * 这类缺陷的症状是功能在某一档消失，而元素还在 DOM 里（只是 `display: none`）
 * ——按 `getByText` 断言「链接存在」会全绿。
 *
 * jsdom 不算 CSS，所以这里只测结构与行为；可见性由 `e2e/staticExport.spec.ts` 量。
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

    // 期望来自内容数据而不是写死的清单：抄一份的话两边都忘改时它照样绿
    const expected = [...content.en.nav.links.map(l => l.href), '/gallery']

    expect(inMenu).toEqual(expected)
    expect(inMenu.length).toBe(9)   // 8 个锚点 + Gallery
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
