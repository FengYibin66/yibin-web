export interface PublicationRoomItem {
  id: string
  title: string
  venue: string
  year: number
  authors: string
  abstract: string
  doi?: string
  keywords: readonly string[]
  featured: boolean
}
