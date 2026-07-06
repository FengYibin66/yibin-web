import { useContext } from 'react'
import { LocaleContext } from '../components/providers/LocaleProvider'

export function useLocale() {
  return useContext(LocaleContext)
}
