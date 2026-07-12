import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'
import { content, type Locale } from '@/lib/content'
import type { PublicationItem } from '@/lib/content/types'
import { PUBLICATION_ORDER } from '@/lib/content/publicationItems'

const ABSTRACT_FALLBACKS: Record<Locale, string> = {
  en: 'Abstract unavailable. Please view the publication for details.',
  zh: '暂无摘要，请查看论文原文了解详情。',
}

function resolvePaperUrl(item: PublicationItem): string | undefined {
  if (item.doi) return item.doi
  const first = item.links?.[0]?.url
  return first
}

function mapPublicationRoomItem(
  locale: Locale,
  item: PublicationItem,
  seenIds: Set<string>,
): PublicationRoomItem {
  if (seenIds.has(item.id)) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": duplicate id "${item.id}"`,
    )
  }
  seenIds.add(item.id)

  const paperUrl = resolvePaperUrl(item)
  if (!paperUrl) {
    throw new Error(
      `Publication mapping failed for locale "${locale}": "${item.id}" has no DOI or link`,
    )
  }

  return {
    id: item.id,
    title: item.title,
    venue: item.venue,
    year: item.year,
    authors: item.authors,
    abstract: item.abstract ?? ABSTRACT_FALLBACKS[locale],
    // Keep doi for ACM papers; non-DOI papers still expose a clickable URL via paperUrl.
    doi: item.doi,
    paperUrl,
    keywords: [...item.keywords],
    featured: item.featured === true,
    image: item.image ?? '/publications/03-social-norms.png',
  }
}

/**
 * Adapt Classic publication list → 3D clothesline items.
 * Syncs all Classic papers (ACM DOI + OpenReview/arXiv).
 */
export function adaptPublicationRoomItems(
  locale: Locale,
  items: readonly PublicationItem[],
): readonly PublicationRoomItem[] {
  const idCounts = new Map<string, number>()
  for (const item of items) {
    idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1)
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      throw new Error(
        `Publication mapping failed for locale "${locale}": duplicate id "${id}"`,
      )
    }
  }

  const byId = new Map(items.map(item => [item.id, item]))
  const seenIds = new Set<string>()

  const ordered = PUBLICATION_ORDER.map(id => {
    const item = byId.get(id)
    if (!item) {
      throw new Error(
        `Publication mapping failed for locale "${locale}": missing Classic id "${id}"`,
      )
    }
    return mapPublicationRoomItem(locale, item, seenIds)
  })

  // Any extra Classic items beyond the ordered set (forward-compatible)
  for (const item of items) {
    if (!seenIds.has(item.id)) {
      ordered.push(mapPublicationRoomItem(locale, item, seenIds))
    }
  }

  return ordered
}

export function getPublicationRoomItems(
  locale: Locale,
): readonly PublicationRoomItem[] {
  return adaptPublicationRoomItems(locale, content[locale].publications.items)
}
