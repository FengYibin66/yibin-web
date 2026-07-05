import type { RankedItem } from '@/types/artifacts'

/** 富化 Digest 常用标签（与 llm-service _digest_tags 对齐） */
export const DIGEST_TAG_SUGGESTIONS = [
  '大模型',
  'Agent',
  '融资',
  '安全',
  '应用',
  '开源',
  '论文',
  '产品发布',
  '监管',
  '基础设施',
] as const

export const UNTAGGED_LABEL = '未分类'

export interface TagGroup {
  tag: string
  items: RankedItem[]
}

export function primaryTag(item: RankedItem): string {
  const tag = item.tags?.[0]?.trim()
  return tag || UNTAGGED_LABEL
}

export function countTagDistribution(items: RankedItem[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const tag = primaryTag(item)
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  const ordered: { tag: string; count: number }[] = []
  for (const tag of DIGEST_TAG_SUGGESTIONS) {
    const count = counts.get(tag)
    if (count) {
      ordered.push({ tag, count })
      counts.delete(tag)
    }
  }

  const untagged = counts.get(UNTAGGED_LABEL)
  if (untagged) {
    ordered.push({ tag: UNTAGGED_LABEL, count: untagged })
    counts.delete(UNTAGGED_LABEL)
  }

  for (const [tag, count] of counts.entries()) {
    ordered.push({ tag, count })
  }

  return ordered
}

export function groupItemsByPrimaryTag(items: RankedItem[]): TagGroup[] {
  const distribution = countTagDistribution(items)
  const buckets = new Map<string, RankedItem[]>()

  for (const item of items) {
    const tag = primaryTag(item)
    const list = buckets.get(tag) ?? []
    list.push(item)
    buckets.set(tag, list)
  }

  return distribution
    .map(({ tag }) => ({ tag, items: buckets.get(tag) ?? [] }))
    .filter((group) => group.items.length > 0)
}
