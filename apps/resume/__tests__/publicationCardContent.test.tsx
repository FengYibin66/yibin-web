import { describe, expect, it, vi } from 'vitest'
import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'
import {
  createPublicationCardBackViewModel,
  createPublicationCardFrontViewModel,
  openPublicationPaper,
} from '@/components/rooms/publications/publicationCardViewModel'

const PUBLICATION: PublicationRoomItem = {
  id: 'paper-2026',
  title: 'Designing Tangible Research Rooms',
  venue: 'CHI',
  year: 2026,
  authors: 'Yibin Feng, Ada Lovelace',
  abstract: 'A study of tangible interfaces for research communication.',
  doi: 'https://doi.org/10.1145/example',
  keywords: ['tangible interaction', 'research communication'],
  featured: true,
}

describe('publication card content', () => {
  it('builds the front venue, year, title, and authors content', () => {
    const viewModel = createPublicationCardFrontViewModel(PUBLICATION)

    expect(viewModel).toEqual({
      venueAndYear: 'CHI · 2026',
      title: PUBLICATION.title,
      authors: PUBLICATION.authors,
      isFeatured: true,
    })
  })

  it('builds the back abstract, keywords, and paper action content', () => {
    const viewModel = createPublicationCardBackViewModel(PUBLICATION)

    expect(viewModel).toEqual({
      abstractHeading: 'ABSTRACT',
      abstract: PUBLICATION.abstract,
      keywords: 'tangible interaction · research communication',
      paperAction: {
        label: 'VIEW PAPER',
        href: PUBLICATION.doi,
      },
    })
  })

  it('hides the paper action when the publication has no DOI', () => {
    const viewModel = createPublicationCardBackViewModel({
      ...PUBLICATION,
      doi: undefined,
    })

    expect(viewModel.paperAction).toBeNull()
  })

  it('opens the DOI in a protected new tab', () => {
    const openWindow = vi.fn()

    openPublicationPaper(PUBLICATION.doi!, openWindow)

    expect(openWindow).toHaveBeenCalledWith(
      PUBLICATION.doi,
      '_blank',
      'noopener,noreferrer',
    )
  })
})
