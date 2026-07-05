'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Locale } from '../../lib/content/types'

export interface LocaleContextValue {
  locale: Locale
  toggle: () => void
}

const throwingDefault: LocaleContextValue = {
  get locale(): Locale {
    throw new Error('useLocale must be used within LocaleProvider')
  },
  toggle() {
    throw new Error('useLocale must be used within LocaleProvider')
  },
}

export const LocaleContext = createContext<LocaleContextValue>(throwingDefault)

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem('resume-locale')
  return stored === 'zh' ? 'zh' : 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    const stored = localStorage.getItem('resume-locale')
    const synced: Locale = stored === 'zh' ? 'zh' : 'en'
    setLocale(synced)
    document.documentElement.lang = synced
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const toggle = () => {
    setLocale(prev => {
      const next: Locale = prev === 'en' ? 'zh' : 'en'
      localStorage.setItem('resume-locale', next)
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
