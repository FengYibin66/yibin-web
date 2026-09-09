'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { LocaleToggle } from '@/components/ui'

interface NavbarProps {
  /** Where the brand name links to. Defaults to "/" (entry page). */
  brandHref?: string
}

export function Navbar({ brandHref = '/' }: NavbarProps) {
  const { locale } = useLocale()
  const c = content[locale].nav
  const [scrolled, setScrolled] = useState(false)
  // Always init true (dark) — matches SSR default and avoids hydration mismatch.
  // The inline script in layout.tsx <head> sets data-theme before paint (no FOUC),
  // so the useEffect sync only triggers a React state update, not a visible flash.
  const [isDark, setIsDark] = useState(true)
  /**
   * 窄屏汉堡菜单。
   *
   * 原先 `<768` 下那 9 个导航入口是 `hidden md:flex`——**藏起来了，没有替代入口**。
   * 而 `/classic/` 在 390px 上高 18056px，用户只能一路滑。
   * 这不是"手机上简化"，是那一档的导航功能整个消失。
   */
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    setIsDark(!isLight)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  /*
    ESC 关菜单。

    不用 `lib/lab/app/escapeStack`——那个栈是 Lab 的（走廊 / 房间 / 停靠视图三层
    互相认领），Classic 页没有第二个 ESC 消费者，引进去只是让 Classic 依赖 Lab 的
    运行时。真出现第二个的时候再收编。
  */
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  /*
    滚动就收起。

    菜单是钉在顶栏上的，而这一页有 18056px 可滑——不收起的话它会一路跟着，
    盖住内容。这里刻意**不锁滚动**：锁了要动 Lenis（`lenis.stop()`），
    而这是个下拉菜单不是模态，代价不值（Lenis 与 `scroll-padding-top`
    互相干扰的坑见 AGENTS.md）。
  */
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('scroll', close, { passive: true, once: true })
    return () => window.removeEventListener('scroll', close)
  }, [menuOpen])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('resume-theme', next ? 'dark' : 'light')
  }

  return (
    <nav
      className="fixed top-0 w-full z-50 transition-all duration-300"
      style={
        // 菜单开着也要不透明：菜单挂在顶栏里，透明背景下 9 个链接会和页面内容
        // 叠在一起，字压字。
        scrolled || menuOpen
          ? {
              backdropFilter: 'blur(12px)',
              // 原先写死 rgba(7,11,18,0.80)（= 深色主题的 --bg-base），于是浅色
              // 主题下滚动后导航栏变成深色条、品牌文字几乎不可见（审计 E2）。
              background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)',
              borderBottom: '1px solid var(--bg-border)',
            }
          : { background: 'transparent' }
      }
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href={brandHref}
          className="font-display font-bold text-lg transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}
        >
          {c.brand}
        </a>

        <div className="hidden md:flex items-center gap-6">
          {c.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors hover:text-[#00d4ff]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/gallery"
            className="text-sm transition-colors hover:text-[#00d4ff]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Gallery
          </a>
        </div>

        <div className="flex items-center gap-3">
          {/* 汉堡：只在窄屏出现，宽屏那 9 个链接是平铺的 */}
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border transition-colors"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--bg-border)',
              color: 'var(--text-secondary)',
            }}
            aria-label={menuOpen ? c.closeMenu : c.menu}
            aria-expanded={menuOpen}
            aria-controls="navbar-menu"
            data-testid="navbar-menu-toggle"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
          <LocaleToggle />
          <button
            type="button"
            onClick={toggleTheme}
            /* 44：原先 w-8 h-8 = 32×32，低于触摸目标下限 */
            className="inline-flex items-center justify-center w-11 h-11 rounded-full border transition-all duration-200 hover:border-[#00d4ff] hover:text-[#00d4ff]"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--bg-border)',
              color: 'var(--text-secondary)',
              fontSize: '1rem',
            }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/*
        菜单面板。放在顶栏**里面**（不是第二个 fixed 元素）：顶栏自己已经是
        `fixed top-0 w-full`，面板作为它的块级子元素天然跟着钉住，
        不需要再写一处坐标——那正是 ADR 20260909182319 要消灭的东西。

        每一项 `min-h-11`：9 个链接挨在一起时，小于 44 的行高在手机上点错的
        概率很高，而点错的后果是跳到错误的锚点、再滑回来。
      */}
      {menuOpen && (
        <div
          id="navbar-menu"
          className="md:hidden border-t"
          style={{
            borderColor: 'var(--bg-border)',
            /*
              面板自己**不透明**，不跟着顶栏那层 80% + blur。

              顶栏细、半透明是刻意的设计；而这是 9 行、近半屏高的面板，
              半透明下它的文字对比度取决于**背后正好是什么**——首屏那几个
              彩色光斑经过 blur 之后仍会把某几行的底色抬亮。
              深浅两档实拍都还读得动，但那是运气，不是保证。

              这个组件已经因为背景写死栽过一次（审计 E2：滚动后写死
              `rgba(7,11,18,0.80)`，浅色主题下变成深色条、品牌字几乎不可见），
              所以用主题变量而不是具体颜色。
            */
            background: 'var(--bg-base)',
          }}
          data-testid="navbar-menu"
        >
          <div className="max-w-6xl mx-auto px-6 py-2 flex flex-col">
            {[...c.links, { label: 'Gallery', href: '/gallery' }].map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center min-h-11 text-sm transition-colors hover:text-[#00d4ff]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
