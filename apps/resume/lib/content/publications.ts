import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'
import { content, type Locale } from '@/lib/content'
import type { PublicationItem } from '@/lib/content/types'

const PUBLICATION_IDS = ['cscw25', 'acm23', 'chi25'] as const
type PublicationId = (typeof PUBLICATION_IDS)[number]

const PUBLICATION_ID_BY_DOI: Readonly<Partial<Record<string, PublicationId>>> = {
  'https://doi.org/10.1145/3715070.3749246': 'cscw25',
  'https://doi.org/10.1145/3757633': 'acm23',
  'https://doi.org/10.1145/3706599.3719973': 'chi25',
}

const ABSTRACT_FALLBACKS: Record<Locale, string> = {
  en: 'Abstract unavailable. Please view the publication for details.',
  zh: '暂无摘要，请查看论文原文了解详情。',
}

function normalizeDoiUrl(locale: Locale, doi?: string): string {
  if (!doi) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": DOI missing`,
    )
  }

  let url: URL
  try {
    url = new URL(doi)
  } catch {
    throw new Error(
      `Publication mapping failed for locale "${locale}": invalid DOI "${doi}"`,
    )
  }

  if (url.protocol !== 'https:') {
    throw new Error(
      `Publication mapping failed for locale "${locale}": DOI must use HTTPS "${doi}"`,
    )
  }

  const doiMatch = decodeURIComponent(url.pathname).match(
    /\/(10\.\d{4,9}\/.+)$/i,
  )
  if (!doiMatch) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": invalid DOI "${doi}"`,
    )
  }

  return `https://doi.org/${doiMatch[1].replace(/\/$/, '').toLowerCase()}`
}

function mapPublicationRoomItem(
  locale: Locale,
  item: PublicationItem,
  seenDois: Set<string>,
): PublicationRoomItem {
  const normalizedDoi = normalizeDoiUrl(locale, item.doi)
  if (seenDois.has(normalizedDoi)) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": duplicate DOI "${normalizedDoi}"`,
    )
  }
  seenDois.add(normalizedDoi)

  const id = PUBLICATION_ID_BY_DOI[normalizedDoi]
  if (!id) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": unknown DOI "${normalizedDoi}"`,
    )
  }

  return {
    id,
    title: item.title,
    venue: item.venue,
    year: item.year,
    authors: item.authors,
    abstract: item.abstract ?? ABSTRACT_FALLBACKS[locale],
    doi: normalizedDoi,
    keywords: [...item.keywords],
    featured: id === 'cscw25',
    // Temporary: reuse CSCW poster until each paper has its own cover art.
    image: item.image ?? '/publications-cscw-cover.png',
  }
}

function assertCompleteDoiMapping(
  locale: Locale,
  roomItems: readonly PublicationRoomItem[],
  seenDois: ReadonlySet<string>,
): void {
  const mappedIds = new Set(roomItems.map(item => item.id))
  const missingIds = PUBLICATION_IDS.filter(id => !mappedIds.has(id))
  if (missingIds.length > 0) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": DOI mapping incomplete; missing IDs: ${missingIds.join(', ')}; DOIs: ${[...seenDois].join(', ')}`,
    )
  }
}

export function adaptPublicationRoomItems(
  locale: Locale,
  items: readonly PublicationItem[],
): readonly PublicationRoomItem[] {
  const seenDois = new Set<string>()
  const roomItems = items.map(item =>
    mapPublicationRoomItem(locale, item, seenDois),
  )
  assertCompleteDoiMapping(locale, roomItems, seenDois)
  return roomItems
}

export function getPublicationRoomItems(
  locale: Locale,
): readonly PublicationRoomItem[] {
  return adaptPublicationRoomItems(locale, content[locale].publications.items)
}
