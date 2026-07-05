import type { RankedItem } from '@/types/artifacts'

export interface RankStepMeta {
  mode: 'llm' | 'rule' | string
  error?: string
  candidateCount?: number
  inputArticleCount?: number
}

export interface RankStepOutput {
  usedFallback: boolean
  topCount: number
  meta: RankStepMeta
  items: RankedItem[]
}
