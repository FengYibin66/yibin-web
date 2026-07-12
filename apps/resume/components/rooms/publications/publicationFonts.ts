import type { Locale } from '@/lib/content'

/** Latin sketch face used for English publication card text. */
export const PUBLICATION_FONT_EN_BOLD = '/fonts/CabinSketch-Bold.ttf'
export const PUBLICATION_FONT_EN_REGULAR = '/fonts/CabinSketch-Regular.ttf'

/**
 * Handwritten CJK face for Chinese publication card text.
 * CabinSketch has no Han glyphs; without this, troika falls back to a plain system font.
 */
export const PUBLICATION_FONT_ZH = '/fonts/ZCOOLKuaiLe-Regular.ttf'

export interface PublicationFonts {
  /** Titles / emphasis (Han or Latin depending on locale). */
  bold: string
  /** Body copy (abstract, keywords). */
  regular: string
  /** Always Latin sketch — venue lines and CTA stay CabinSketch. */
  latinBold: string
}

export function getPublicationFonts(locale: Locale): PublicationFonts {
  if (locale === 'zh') {
    return {
      bold: PUBLICATION_FONT_ZH,
      regular: PUBLICATION_FONT_ZH,
      latinBold: PUBLICATION_FONT_EN_BOLD,
    }
  }

  return {
    bold: PUBLICATION_FONT_EN_BOLD,
    regular: PUBLICATION_FONT_EN_REGULAR,
    latinBold: PUBLICATION_FONT_EN_BOLD,
  }
}
