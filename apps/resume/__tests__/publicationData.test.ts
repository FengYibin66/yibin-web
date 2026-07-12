import { describe, expect, it } from 'vitest'
import { content, type Locale } from '@/lib/content'
import { getPublicationRoomItems } from '@/lib/content/publications'

const PUBLICATION_IDS = ['cscw25', 'acm23', 'chi25'] as const
const ABSTRACT_FALLBACKS: Record<Locale, string> = {
  en: 'Abstract unavailable. Please view the publication for details.',
  zh: '暂无摘要，请查看论文原文了解详情。',
}

describe('publication room data', () => {
  it.each<Locale>(['en', 'zh'])(
    'adapts the %s publication content without duplicating titles',
    locale => {
      const sourceItems = content[locale].publications.items
      const roomItems = getPublicationRoomItems(locale)

      expect(roomItems).toHaveLength(3)
      expect(roomItems.map(item => item.title)).toEqual(
        sourceItems.map(item => item.title),
      )
      expect(roomItems).toEqual(
        sourceItems.map((item, index) => ({
          id: PUBLICATION_IDS[index],
          title: item.title,
          venue: item.venue,
          year: item.year,
          authors: item.authors,
          abstract: item.abstract ?? ABSTRACT_FALLBACKS[locale],
          doi: item.doi,
          keywords: item.keywords,
          featured: item.featured ?? false,
        })),
      )
    },
  )

  it('uses stable unique IDs and features the CSCW publication', () => {
    const items = getPublicationRoomItems('en')

    expect(items.map(item => item.id)).toEqual(PUBLICATION_IDS)
    expect(new Set(items.map(item => item.id)).size).toBe(items.length)
    expect(items.find(item => item.id === 'cscw25')?.featured).toBe(true)
  })

  it.each<Locale>(['en', 'zh'])(
    'provides a localized non-empty abstract fallback for %s',
    locale => {
      const fallbackItems = getPublicationRoomItems(locale).slice(1)

      expect(fallbackItems).toHaveLength(2)
      fallbackItems.forEach(item => {
        expect(item.abstract).toBe(ABSTRACT_FALLBACKS[locale])
        expect(item.abstract.trim()).not.toBe('')
      })
    },
  )

  it.each<Locale>(['en', 'zh'])(
    'uses HTTPS for every DOI in %s',
    locale => {
      getPublicationRoomItems(locale).forEach(item => {
        if (item.doi) {
          expect(item.doi).toMatch(/^https:\/\//)
        }
      })
    },
  )
})
