import type { RankedItem } from '@/types/artifacts'

export interface EnrichStepMeta {
  mode: 'llm' | 'passthrough' | string
  error?: string
}

export interface EnrichStepOutput {
  topCount: number
  meta: EnrichStepMeta
  items: RankedItem[]
}
