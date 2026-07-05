import type { CollectStepOutput } from '@/types/collect'

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

export function parseCollectOutput(output: unknown): CollectStepOutput | null {
  if (!output || typeof output !== 'object') {
    return null
  }

  const record = output as Record<string, unknown>
  const sourceTotal = readNumber(record.sourceTotal)
  const sourceSuccess = readNumber(record.sourceSuccess)
  const articleCount = readNumber(record.articleCount)

  if (sourceTotal === 0 && articleCount === 0 && readStringArray(record.sourceFailed).length === 0) {
    return null
  }

  return {
    sourceTotal,
    sourceSuccess,
    sourceFailed: readStringArray(record.sourceFailed),
    filteredByRecency: readNumber(record.filteredByRecency),
    filteredByKeyword: readNumber(record.filteredByKeyword),
    articleCount,
    savedCount: readNumber(record.savedCount),
  }
}

export function collectMergedCount(data: CollectStepOutput): number {
  return data.articleCount + data.filteredByKeyword + data.filteredByRecency
}

export function collectAfterRecencyCount(data: CollectStepOutput): number {
  return data.articleCount + data.filteredByKeyword
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms < 0) {
    return '—'
  }
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}
