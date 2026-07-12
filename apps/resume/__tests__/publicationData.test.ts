import { describe, expect, it } from 'vitest'
import { content, type Locale } from '@/lib/content'
import {
  adaptPublicationRoomItems,
  getPublicationRoomItems,
} from '@/lib/content/publications'
import { PUBLICATION_ORDER } from '@/lib/content/publicationItems'

describe('publication room data', () => {
  it.each<Locale>(['en', 'zh'])(
    'syncs all Classic %s publications into the 3D room',
    locale => {
      const sourceItems = content[locale].publications.items
      const roomItems = getPublicationRoomItems(locale)

      expect(sourceItems.length).toBe(PUBLICATION_ORDER.length)
      expect(roomItems).toHaveLength(PUBLICATION_ORDER.length)
      expect(roomItems.map(item => item.id)).toEqual([...PUBLICATION_ORDER])
      expect(roomItems.map(item => item.title)).toEqual(
        PUBLICATION_ORDER.map(id => sourceItems.find(s => s.id === id)!.title),
      )
      roomItems.forEach(item => {
        expect(item.abstract?.trim()).not.toBe('')
        expect(item.paperUrl || item.doi).toBeTruthy()
        expect(item.image).toMatch(/^\/publications\//)
      })
    },
  )

  it('features the Classic featured paper', () => {
    const items = getPublicationRoomItems('en')
    const featured = items.filter(item => item.featured)
    expect(featured).toHaveLength(1)
    expect(featured[0]?.id).toBe('03-social-norms')
  })

  it('assigns stable IDs across locales', () => {
    expect(getPublicationRoomItems('en').map(i => i.id)).toEqual(
      getPublicationRoomItems('zh').map(i => i.id),
    )
  })

  it('maps OpenReview / arXiv papers without DOI via paperUrl', () => {
    const items = getPublicationRoomItems('en')
    const openReview = items.find(i => i.id === '04-more-stronger')
    const arxiv = items.find(i => i.id === '05-opinionated-bots')
    expect(openReview?.doi).toBeUndefined()
    expect(openReview?.paperUrl).toMatch(/openreview\.net/)
    expect(arxiv?.doi).toBeUndefined()
    expect(arxiv?.paperUrl).toMatch(/arxiv\.org/)
  })

  it('rejects duplicate ids', () => {
    const sourceItems = content.en.publications.items
    expect(() =>
      adaptPublicationRoomItems('en', [...sourceItems, sourceItems[0]!]),
    ).toThrow(/duplicate id/i)
  })

  it('rejects incomplete Classic order', () => {
    const sourceItems = content.zh.publications.items.slice(0, 2)
    expect(() => adaptPublicationRoomItems('zh', sourceItems)).toThrow(
      /missing Classic id/i,
    )
  })

  it.each<Locale>(['en', 'zh'])(
    'uses HTTPS for every paper URL in %s',
    locale => {
      getPublicationRoomItems(locale).forEach(item => {
        const url = item.doi ?? item.paperUrl
        expect(url).toMatch(/^https:\/\//)
      })
    },
  )
})
