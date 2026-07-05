import { Link } from 'react-router-dom'
import { useLocaleStore } from '@/store/locale'
import { translations } from '@/lib/i18n'

export default function Footer() {
  const { locale, setLocale } = useLocaleStore()
  const t = translations[locale]

  return (
    <footer className="mt-auto border-t border-[#1e2740] py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm" style={{ color: '#4a5568' }}>
          © {new Date().getFullYear()} Yibin Feng · {t.footer.rights}
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="text-sm px-3 py-1 rounded border border-[#1e2740] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
            style={{ color: '#8b9bbc' }}
          >
            {locale === 'en' ? '中文' : 'EN'}
          </button>
          <Link
            to="/admin"
            className="text-xs transition-colors"
            style={{ color: '#4a5568' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#8b9bbc'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}
