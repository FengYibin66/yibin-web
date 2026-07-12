export interface PublicationRoomItem {
  id: string
  title: string
  venue: string
  year: number
  authors: string
  abstract: string
  doi?: string
  /** Primary click-through URL (DOI, OpenReview, or arXiv). */
  paperUrl?: string
  keywords: readonly string[]
  featured: boolean
  /** Cover / poster texture for the hanging paper face (itom mapPainted). */
  image?: string
}

export interface PublicationCardFaceProps {
  publication: PublicationRoomItem
  opacity: number
  depthTest?: boolean
  renderOrder?: number
}
