import type { RankedItem, RunArtifacts } from '@/types/artifacts'
import type { RankStepMeta, RankStepOutput } from '@/types/rank'
import type { CollectStepOutput } from '@/types/collect'
import { parseCollectOutput } from '@/utils/collectOutput'

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

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function parseRankedItem(raw: unknown): RankedItem | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const record = raw as Record<string, unknown>
  const url = readString(record.url)
  const title = readString(record.title)
  if (!url || !title) {
    return null
  }
  return {
    url,
    title,
    score: readNumber(record.score),
    reason: readString(record.reason) || undefined,
    summary: readString(record.summary) || undefined,
    summaryZh: readString(record.summaryZh) || undefined,
    tags: readStringArray(record.tags),
    source: readString(record.source) || undefined,
  }
}

function parseRankMeta(raw: unknown): RankStepMeta {
  if (!raw || typeof raw !== 'object') {
    return { mode: 'unknown' }
  }
  const record = raw as Record<string, unknown>
  return {
    mode: readString(record.mode) || 'unknown',
    error: readString(record.error) || undefined,
    candidateCount: readNumber(record.candidateCount) || undefined,
    inputArticleCount: readNumber(record.inputArticleCount) || undefined,
  }
}

export function parseRankItemsFromOutput(output: unknown): RankedItem[] {
  if (!output || typeof output !== 'object') {
    return []
  }
  const items = (output as Record<string, unknown>).items
  if (!Array.isArray(items)) {
    return []
  }
  return items
    .map(parseRankedItem)
    .filter((item): item is RankedItem => item !== null)
}

export function parseRankOutput(output: unknown): RankStepOutput | null {
  if (!output || typeof output !== 'object') {
    return null
  }

  const record = output as Record<string, unknown>
  const items = parseRankItemsFromOutput(output)
  const topCount = readNumber(record.topCount)

  if (items.length === 0 && topCount === 0 && record.meta == null) {
    return null
  }

  return {
    usedFallback: record.usedFallback === true,
    topCount: topCount || items.length,
    meta: parseRankMeta(record.meta),
    items,
  }
}

export function resolveRankItems(
  stepOutput: unknown,
  artifacts: RunArtifacts | null,
): { items: RankedItem[]; fromDigest: boolean } {
  const parsed = parseRankOutput(stepOutput)
  if (parsed && parsed.items.length > 0) {
    return { items: parsed.items, fromDigest: false }
  }

  const digestItems = artifacts?.digest?.items ?? []
  if (digestItems.length > 0) {
    return {
      items: digestItems.map((item) => ({
        ...item,
        summaryZh: undefined,
      })),
      fromDigest: true,
    }
  }

  return { items: [], fromDigest: false }
}

export function collectStatsFromArtifacts(artifacts: RunArtifacts | null): CollectStepOutput | null {
  const collect = artifacts?.digest?.stats?.collect
  return parseCollectOutput(collect)
}

export function formatScore(score: number): string {
  if (!Number.isFinite(score)) {
    return '—'
  }
  if (score <= 1) {
    return `${Math.round(score * 100)}%`
  }
  return score.toFixed(2)
}

export function scoreTagType(score: number): 'success' | 'warning' | 'info' {
  const normalized = score <= 1 ? score : score / 10
  if (normalized >= 0.75) {
    return 'success'
  }
  if (normalized >= 0.5) {
    return 'warning'
  }
  return 'info'
}
