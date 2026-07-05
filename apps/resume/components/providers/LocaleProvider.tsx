'use client'

import { createContext, useState, useEffect, type ReactNode } from 'react'
import type { Locale } from '../../lib/content/types'

export interface LocaleContextValue {
  locale: Locale
  toggle: () => void
}

const throwingDefault: LocaleContextValue = {
  get locale(): Locale { throw new Error('useLocale must be used within LocaleProvider') },
  toggle() { throw new Error('useLocale must be used within LocaleProvider') },
}

export const LocaleContext = createContext<LocaleContextValue>(throwingDefault)

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start with 'en' — SSR and CSR hydration must produce identical output.
  // localStorage is only read after hydration completes (useEffect).
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const stored = localStorage.getItem('resume-locale')
    const persisted: Locale = stored === 'zh' ? 'zh' : 'en'
    setLocale(persisted)
    document.documentElement.lang = persisted
  }, [])

  const toggle = () => {
    setLocale(prev => {
      const next: Locale = prev === 'en' ? 'zh' : 'en'
      localStorage.setItem('resume-locale', next)
      document.documentElement.lang = next
      return next
    })
  }

  return (
    <LocaleContext.Provider value={{ locale, toggle }}>
      {children}
    </LocaleContext.Provider>
  )
}

export default LocaleProvider
