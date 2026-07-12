import { describe, expect, it } from 'vitest'
import { content, type Locale } from '@/lib/content'
import {
  adaptPublicationRoomItems,
  getPublicationRoomItems,
} from '@/lib/content/publications'

const PUBLICATION_IDS = ['cscw25', 'acm23', 'chi25'] as const
const PUBLICATION_ID_BY_DOI: ReadonlyMap<
  string,
  (typeof PUBLICATION_IDS)[number]
> = new Map([
  ['https://doi.org/10.1145/3715070.3749246', 'cscw25'],
  ['https://dl.acm.org/doi/abs/10.1145/3757633', 'acm23'],
  ['https://dl.acm.org/doi/full/10.1145/3706599.3719973', 'chi25'],
])
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
        sourceItems.map(item => ({
          id: PUBLICATION_ID_BY_DOI.get(item.doi!),
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

  it('assigns the same ID to each DOI across locales', () => {
    const englishIds = new Map(
      getPublicationRoomItems('en').map(item => [item.doi, item.id]),
    )

    getPublicationRoomItems('zh').forEach(item => {
      expect(englishIds.get(item.doi)).toBe(item.id)
    })
  })

  it('assigns IDs by DOI when source items are reordered', () => {
    const sourceItems = content.en.publications.items
    const reorderedItems = [sourceItems[2], sourceItems[0], sourceItems[1]]

    expect(
      adaptPublicationRoomItems('en', reorderedItems).map(item => item.id),
    ).toEqual(['chi25', 'cscw25', 'acm23'])
  })

  it('rejects a publication with an unknown DOI', () => {
    const sourceItems = content.en.publications.items
    const unknownItem = {
      ...sourceItems[0],
      doi: 'https://doi.org/10.1145/unknown',
    }

    expect(() =>
      adaptPublicationRoomItems('en', [unknownItem, ...sourceItems.slice(1)]),
    ).toThrow(/locale "en".*DOI.*10\.1145\/unknown/i)
  })

  it('rejects a publication without a DOI', () => {
    const sourceItems = content.zh.publications.items
    const missingDoiItem = { ...sourceItems[0], doi: undefined }

    expect(() =>
      adaptPublicationRoomItems('zh', [missingDoiItem, ...sourceItems.slice(1)]),
    ).toThrow(/locale "zh".*DOI.*missing/i)
  })

  it('rejects duplicate DOIs within a locale', () => {
    const sourceItems = content.en.publications.items

    expect(() =>
      adaptPublicationRoomItems('en', [
        sourceItems[0],
        sourceItems[0],
        sourceItems[2],
      ]),
    ).toThrow(/locale "en".*duplicate DOI.*3715070\.3749246/i)
  })

  it('rejects an incomplete DOI mapping', () => {
    const sourceItems = content.zh.publications.items

    expect(() =>
      adaptPublicationRoomItems('zh', sourceItems.slice(0, 2)),
    ).toThrow(/locale "zh".*DOI mapping incomplete.*chi25/i)
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
