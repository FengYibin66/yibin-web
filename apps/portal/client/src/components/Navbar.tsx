import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { useLocaleStore } from '@/store/locale'
import { useThemeStore } from '@/store/theme'
import { translations } from '@/lib/i18n'

export default function Navbar() {
  const { locale, setLocale } = useLocaleStore()
  const { theme, toggleTheme } = useThemeStore()
  const t = translations[locale]
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'color-mix(in srgb, var(--bg-base) 80%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--bg-border)' : '1px solid transparent',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <button
          onClick={scrollToTop}
          className="font-semibold text-base transition-colors"
          style={{ fontFamily: 'Space Grotesk, system-ui', color: 'var(--text-primary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
        >
          Yibin Feng
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="text-sm px-3 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded border transition-colors"
            style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link
            to="/admin"
            className="text-sm px-3 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            Admin
          </Link>
        </div>
      </div>
    </nav>
  )
}
