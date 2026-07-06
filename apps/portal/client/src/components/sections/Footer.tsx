import { useLocaleStore } from '@/store/locale'
import { translations } from '@/lib/i18n'

export default function Footer() {
  const { locale } = useLocaleStore()
  const t = translations[locale]

  return (
    <footer className="mt-auto border-t py-8 px-6" style={{ borderColor: 'var(--bg-border)' }}>
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Yibin Feng · {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}
