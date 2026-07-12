import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'
import { content, type Locale } from '@/lib/content'

const PUBLICATION_IDS = ['cscw25', 'acm23', 'chi25'] as const

const ABSTRACT_FALLBACKS: Record<Locale, string> = {
  en: 'Abstract unavailable. Please view the publication for details.',
  zh: '暂无摘要，请查看论文原文了解详情。',
}

export function getPublicationRoomItems(
  locale: Locale,
): readonly PublicationRoomItem[] {
  return content[locale].publications.items.map((item, index) => ({
    id: PUBLICATION_IDS[index],
    title: item.title,
    venue: item.venue,
    year: item.year,
    authors: item.authors,
    abstract: item.abstract ?? ABSTRACT_FALLBACKS[locale],
    doi: item.doi,
    keywords: item.keywords,
    featured: item.featured ?? false,
  }))
}
