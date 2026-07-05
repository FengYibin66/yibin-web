export interface CollectStepOutput {
  sourceTotal: number
  sourceSuccess: number
  sourceFailed: string[]
  filteredByRecency: number
  filteredByKeyword: number
  articleCount: number
  savedCount: number
}
