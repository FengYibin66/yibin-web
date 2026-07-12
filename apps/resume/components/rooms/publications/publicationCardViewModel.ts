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
    paperAction: publication.doi
      ? { label: VIEW_PAPER_LABEL, href: publication.doi }
      : null,
  }
}

export function openPublicationPaper(
  doi: string,
  openWindow: OpenWindow = window.open.bind(window),
): void {
  openWindow(doi, '_blank', 'noopener,noreferrer')
}
