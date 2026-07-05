import { en } from './en'
import { zh } from './zh'

export { en }
export { zh }
export const content = { en, zh } as const
export type { SiteContent, Locale } from './types'
