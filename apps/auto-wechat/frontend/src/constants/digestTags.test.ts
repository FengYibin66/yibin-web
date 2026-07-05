import { describe, expect, it } from 'vitest'

import { countTagDistribution, groupItemsByPrimaryTag } from './digestTags'
import type { RankedItem } from '@/types/artifacts'

describe('digestTags', () => {
  const items: RankedItem[] = [
    { url: 'https://a.test/1', title: 'A', score: 1, tags: ['大模型'] },
    { url: 'https://a.test/2', title: 'B', score: 1, tags: ['Agent'] },
    { url: 'https://a.test/3', title: 'C', score: 1 },
  ]

  it('counts tag distribution', () => {
    const dist = countTagDistribution(items)
    expect(dist).toEqual([
      { tag: '大模型', count: 1 },
      { tag: 'Agent', count: 1 },
      { tag: '未分类', count: 1 },
    ])
  })

  it('groups items by primary tag', () => {
    const groups = groupItemsByPrimaryTag(items)
    expect(groups).toHaveLength(3)
    expect(groups[0]?.tag).toBe('大模型')
  })
})
