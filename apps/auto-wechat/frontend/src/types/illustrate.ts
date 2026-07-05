export type IllustrationSlotStatus = 'pending' | 'ready' | 'failed'

export type IllustrationImageSource =
  | 'rss'
  | 'og'
  | 'scraped'
  | 'generated'
  | 'upload'
  | 'library'

export interface IllustrationBindTo {
  sourceUrl: string
  headline: string
  section?: string
  rank: number
}

export interface IllustrationImage {
  assetId?: string | null
  inLibrary?: boolean
  url: string
  source: IllustrationImageSource | string
  originUrl?: string
  width?: number
  height?: number
  relevanceScore?: number
  prompt?: string
}

export interface IllustrationSlot {
  id: string
  role: 'news_thumbnail'
  bindTo: IllustrationBindTo
  image: IllustrationImage
  status: IllustrationSlotStatus
  errorMessage?: string | null
}

export interface IllustrationStats {
  total: number
  ready: number
  failed: number
  inLibrary: number
  bySource?: Record<string, number>
}

export interface IllustrationOutput {
  planVersion: string
  slots: IllustrationSlot[]
  stats: IllustrationStats
}
