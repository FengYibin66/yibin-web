import { describe, expect, it } from 'vitest'
import {
  getPublicationFonts,
  PUBLICATION_FONT_EN_BOLD,
  PUBLICATION_FONT_EN_REGULAR,
  PUBLICATION_FONT_ZH,
} from '@/components/rooms/publications/publicationFonts'

describe('getPublicationFonts', () => {
  it('uses CabinSketch for English', () => {
    expect(getPublicationFonts('en')).toEqual({
      bold: PUBLICATION_FONT_EN_BOLD,
      regular: PUBLICATION_FONT_EN_REGULAR,
      latinBold: PUBLICATION_FONT_EN_BOLD,
    })
  })

  it('uses ZCOOL KuaiLe for Chinese Han text and CabinSketch for Latin venue/CTA', () => {
    expect(getPublicationFonts('zh')).toEqual({
      bold: PUBLICATION_FONT_ZH,
      regular: PUBLICATION_FONT_ZH,
      latinBold: PUBLICATION_FONT_EN_BOLD,
    })
  })
})
