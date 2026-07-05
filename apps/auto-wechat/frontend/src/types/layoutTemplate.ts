export interface LayoutTemplateSummary {
  id: string
  name: string
  description?: string
  articleType: string
  tags?: string[]
  hasSvg: boolean
  itemCountMin: number
  itemCountMax: number
  qualityScore: number
  usageCount: number
  isFeatured: boolean
  isDefault: boolean
  sourceRunId?: string
  createdAt: string
  updatedAt: string
}

export interface LayoutTemplateDetail extends LayoutTemplateSummary {
  bodyHtml: string
}

export interface TemplateMatchEntry {
  templateId: string
  score: number
  reason: string
}

export interface TemplateMatchResult {
  ranked: TemplateMatchEntry[]
}

export interface CreateLayoutTemplatePayload {
  name: string
  description?: string
  articleType?: string
  tags?: string[]
  bodyHtml: string
  hasSvg?: boolean
  itemCountMin?: number
  itemCountMax?: number
  qualityScore?: number
  isFeatured?: boolean
}

export interface SaveRunAsLayoutTemplatePayload {
  name: string
  description?: string
  tags?: string[]
}
