import { describe, expect, it } from 'vitest'

import { formatScore, parseRankOutput, resolveRankItems, scoreTagType } from './rankOutput'

describe('parseRankOutput', () => {
  it('parses rank step with items', () => {
    const result = parseRankOutput({
      usedFallback: false,
      topCount: 2,
      meta: { mode: 'llm', candidateCount: 120, inputArticleCount: 28 },
      items: [
        { url: 'https://a.test/1', title: 'A', score: 0.92, reason: '重要', source: 'OpenAI' },
        { url: 'https://a.test/2', title: 'B', score: 0.8, reason: '热点', source: 'HN' },
      ],
    })

    expect(result?.topCount).toBe(2)
    expect(result?.meta.mode).toBe('llm')
    expect(result?.items).toHaveLength(2)
  })
})

describe('resolveRankItems', () => {
  it('falls back to digest when step has no items', () => {
    const { items, fromDigest } = resolveRankItems(
      { topCount: 1, usedFallback: true, meta: { mode: 'rule' }, items: [] },
      {
        runId: 'r1',
        runStatus: 'succeeded',
        publishMode: 'draft_only',
        steps: [],
        digest: {
          id: 'd1',
          runId: 'r1',
          items: [{ url: 'https://a.test/1', title: 'From digest', score: 0.5 }],
        },
      },
    )

    expect(fromDigest).toBe(true)
    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('From digest')
  })
})

describe('formatScore', () => {
  it('formats normalized scores', () => {
    expect(formatScore(0.92)).toBe('92%')
    expect(scoreTagType(0.92)).toBe('success')
  })
})
