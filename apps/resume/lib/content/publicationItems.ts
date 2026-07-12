import type { PublicationItem } from './types'

/** Shared ids / images / links; locale files supply translated copy. */
export const PUBLICATION_META = {
  '03-social-norms': {
    id: '03-social-norms',
    image: '/publications/03-social-norms.png',
    year: 2025,
    citations: 3,
    role: 'first' as const,
    featured: true,
    doi: 'https://doi.org/10.1145/3715070.3749246',
    links: [
      { label: 'DOI', url: 'https://doi.org/10.1145/3715070.3749246' },
      { label: 'ACM', url: 'https://dl.acm.org/doi/10.1145/3715070.3749246' },
    ],
  },
  '01-social-groups': {
    id: '01-social-groups',
    image: '/publications/01-social-groups.png',
    year: 2025,
    citations: 37,
    role: 'coauthor' as const,
    featured: false,
    doi: 'https://doi.org/10.1145/3757633',
    links: [
      { label: 'DOI', url: 'https://doi.org/10.1145/3757633' },
      { label: 'ACM', url: 'https://dl.acm.org/doi/10.1145/3757633' },
    ],
  },
  '02-greater-sum': {
    id: '02-greater-sum',
    image: '/publications/02-greater-sum.png',
    year: 2025,
    citations: 11,
    role: 'coauthor' as const,
    featured: false,
    doi: 'https://doi.org/10.1145/3706599.3719973',
    links: [
      { label: 'DOI', url: 'https://doi.org/10.1145/3706599.3719973' },
      { label: 'ACM', url: 'https://dl.acm.org/doi/10.1145/3706599.3719973' },
    ],
  },
  '04-more-stronger': {
    id: '04-more-stronger',
    image: '/publications/04-more-stronger.png',
    year: 2025,
    citations: 3,
    role: 'coauthor' as const,
    featured: false,
    doi: undefined,
    links: [
      { label: 'OpenReview PDF', url: 'https://openreview.net/pdf?id=6zlttMWe4G' },
      { label: 'OpenReview', url: 'https://openreview.net/forum?id=6zlttMWe4G' },
    ],
  },
  '05-opinionated-bots': {
    id: '05-opinionated-bots',
    image: '/publications/05-opinionated-bots.png',
    year: 2026,
    citations: 0,
    role: 'coauthor' as const,
    featured: false,
    doi: undefined,
    links: [
      { label: 'arXiv PDF', url: 'https://arxiv.org/pdf/2606.11693' },
      { label: 'arXiv', url: 'https://arxiv.org/abs/2606.11693' },
    ],
  },
} as const

export type PublicationId = keyof typeof PUBLICATION_META

/** Classic display order: first-author featured, then Scholar citation order. */
export const PUBLICATION_ORDER: PublicationId[] = [
  '03-social-norms',
  '01-social-groups',
  '02-greater-sum',
  '04-more-stronger',
  '05-opinionated-bots',
]

export function mergePublication(
  id: PublicationId,
  localeFields: Omit<PublicationItem, 'id' | 'image' | 'year' | 'citations' | 'role' | 'featured' | 'doi' | 'links'>,
): PublicationItem {
  const meta = PUBLICATION_META[id]
  return {
    ...localeFields,
    id: meta.id,
    image: meta.image,
    year: meta.year,
    citations: meta.citations,
    role: meta.role,
    featured: meta.featured,
    doi: meta.doi,
    links: [...meta.links],
  }
}
