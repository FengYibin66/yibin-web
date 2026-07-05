import { describe, expect, it } from 'vitest'

import { countItemsWithSummaryZh, parseEnrichOutput } from './enrichOutput'

describe('parseEnrichOutput', () => {
  it('parses enrich step output', () => {
    const result = parseEnrichOutput({
      topCount: 2,
      meta: { mode: 'llm' },
      items: [
        { url: 'https://a.test/1', title: 'A', summaryZh: '摘要一', tags: ['大模型'] },
        { url: 'https://a.test/2', title: 'B', summaryZh: '摘要二' },
      ],
    })

    expect(result?.meta.mode).toBe('llm')
    expect(result?.items).toHaveLength(2)
    expect(countItemsWithSummaryZh(result!.items)).toBe(2)
  })
})
