import type { PublicationRoomItem } from './publicationTypes'

const ABSTRACT_HEADING = 'ABSTRACT'
const VIEW_PAPER_LABEL = 'VIEW PAPER'
const CONTENT_SEPARATOR = ' · '

export interface PublicationCardFrontViewModel {
  venueAndYear: string
  title: string
  authors: string
  isFeatured: boolean
}

export interface PublicationCardBackViewModel {
  abstractHeading: typeof ABSTRACT_HEADING
  abstract: string
  keywords: string
  paperAction: {
    label: typeof VIEW_PAPER_LABEL
    href: string
  } | null
}

type OpenWindow = (
  url: string,
  target: string,
  features: string,
) => unknown

export function createPublicationCardFrontViewModel(
  publication: PublicationRoomItem,
): PublicationCardFrontViewModel {
  return {
    venueAndYear: [publication.venue, publication.year].join(CONTENT_SEPARATOR),
    title: publication.title,
    authors: publication.authors,
    isFeatured: publication.featured,
  }
}

export function createPublicationCardBackViewModel(
  publication: PublicationRoomItem,
): PublicationCardBackViewModel {
  return {
    abstractHeading: ABSTRACT_HEADING,
    abstract: publication.abstract,
    keywords: publication.keywords.join(CONTENT_SEPARATOR),
    paperAction: (() => {
      const href = publication.doi ?? publication.paperUrl
      return href ? { label: VIEW_PAPER_LABEL, href } : null
    })(),
  }
}

export function openPublicationPaper(
  url: string,
  openWindow: OpenWindow = window.open.bind(window),
): void {
  const opened = openWindow(url, '_blank', 'noopener,noreferrer')
  if (opened == null) {
    console.warn('[pub] window.open blocked for', url)
  }
}
