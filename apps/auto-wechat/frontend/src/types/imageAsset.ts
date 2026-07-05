export type ImageAssetSource = 'generated' | 'upload' | 'rss' | 'og' | 'scraped'

export interface ImageAssetProvenance {
  firstRunId?: string
  firstSlotId?: string
  headline?: string
}

export interface ImageAsset {
  id: string
  name: string
  url: string
  storage: string
  source: ImageAssetSource | string
  originUrl?: string
  prompt?: string
  mimeType: string
  byteSize: number
  width?: number
  height?: number
  contentHash: string
  tags?: string[]
  provenance?: ImageAssetProvenance
  usageCount: number
  autoIngested: boolean
  createdAt: string
  updatedAt: string
}
