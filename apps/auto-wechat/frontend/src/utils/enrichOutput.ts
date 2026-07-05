import type { RankedItem, RunArtifacts } from '@/types/artifacts'
import type { EnrichStepMeta, EnrichStepOutput } from '@/types/enrich'
import { parseRankItemsFromOutput } from '@/utils/rankOutput'

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

function parseEnrichMeta(raw: unknown): EnrichStepMeta {
  if (!raw || typeof raw !== 'object') {
    return { mode: 'unknown' }
  }
  const record = raw as Record<string, unknown>
  return {
    mode: readString(record.mode) || 'unknown',
    error: readString(record.error) || undefined,
  }
}

export function parseEnrichOutput(output: unknown): EnrichStepOutput | null {
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
    topCount: topCount || items.length,
    meta: parseEnrichMeta(record.meta),
    items,
  }
}

export function resolveEnrichItems(
  stepOutput: unknown,
  digestItems: RankedItem[],
): { items: RankedItem[]; fromDigest: boolean } {
  const parsed = parseEnrichOutput(stepOutput)
  if (parsed && parsed.items.length > 0) {
    return { items: parsed.items, fromDigest: false }
  }
  if (digestItems.length > 0) {
    return { items: digestItems, fromDigest: true }
  }
  return { items: [], fromDigest: false }
}

export function countItemsWithSummaryZh(items: RankedItem[]): number {
  return items.filter((item) => (item.summaryZh ?? '').trim().length > 0).length
}

export function countItemsWithTags(items: RankedItem[]): number {
  return items.filter((item) => (item.tags?.length ?? 0) > 0).length
}

export function enrichStatsFromArtifacts(artifacts: RunArtifacts | null): EnrichStepOutput | null {
  const enrich = artifacts?.digest?.stats?.enrich
  return parseEnrichOutput(enrich)
}
