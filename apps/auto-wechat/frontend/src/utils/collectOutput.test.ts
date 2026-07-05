import { describe, expect, it } from 'vitest'

import { collectMergedCount, parseCollectOutput } from './collectOutput'

describe('parseCollectOutput', () => {
  it('parses collect step output', () => {
    const result = parseCollectOutput({
      sourceTotal: 25,
      sourceSuccess: 22,
      sourceFailed: ['量子位'],
      filteredByRecency: 40,
      filteredByKeyword: 12,
      articleCount: 28,
      savedCount: 15,
    })

    expect(result).toEqual({
      sourceTotal: 25,
      sourceSuccess: 22,
      sourceFailed: ['量子位'],
      filteredByRecency: 40,
      filteredByKeyword: 12,
      articleCount: 28,
      savedCount: 15,
    })
    expect(collectMergedCount(result!)).toBe(80)
  })

  it('returns null for empty output', () => {
    expect(parseCollectOutput(null)).toBeNull()
    expect(parseCollectOutput({})).toBeNull()
  })
})
