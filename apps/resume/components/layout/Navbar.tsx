'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { LocaleToggle } from '@/components/ui'

export function Navbar() {
  const { locale } = useLocale()
  const c = content[locale].nav
  const [scrolled, setScrolled] = useState(false)
  // Always init true (dark) — matches SSR default and hydration output.
  // The inline script in layout.tsx <head> already set data-theme before paint
  // (no FOUC), so the useEffect sync below only causes a React state update,
  // not a visible flash.
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    setIsDark(!isLight)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        scrolled
          ? {
              backdropFilter: 'blur(12px)',
              background: 'rgba(7,11,18,0.80)',
              borderBottom: '1px solid var(--bg-border)',
            }
          : { background: 'transparent' }
      }
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="font-display font-bold text-lg transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}
        >
          {c.brand}
        </a>

        {/* Nav links — hidden on mobile */}
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
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <LocaleToggle />
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 hover:border-[#00d4ff] hover:text-[#00d4ff]"
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
    </nav>
  )
}
