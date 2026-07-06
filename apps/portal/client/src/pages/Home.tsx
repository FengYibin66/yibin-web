import { useEffect } from 'react'
import { useLocaleStore } from '@/store/locale'
import type { Locale } from '@/lib/i18n'
import Navbar from '@/components/Navbar'
import Hero from '@/components/sections/Hero'
import Projects from '@/components/sections/Projects'
import Footer from '@/components/sections/Footer'

interface Props { lang?: Locale }

export default function Home({ lang }: Props) {
  const { locale, setLocale } = useLocaleStore()

  useEffect(() => {
    if (lang && lang !== locale) setLocale(lang)
  }, [lang])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <Navbar />
      <main className="flex flex-col flex-1 pt-14">
        <Hero />
        <Projects />
      </main>
      <Footer />
    </div>
  )
}
