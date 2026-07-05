import { describe, expect, it } from 'vitest'

import {
  countMarkdownSections,
  estimateWordCount,
  parseWriterOutput,
  resolveWriterOutput,
} from '@/utils/writerOutput'

describe('parseWriterOutput', () => {
  it('parses writer step payload', () => {
    const result = parseWriterOutput({
      title: 'AI 周报',
      titleCandidates: ['备选 A', '备选 B'],
      summary: '本周要点',
      bodyMarkdown: '## 大模型\n\n正文',
      sources: [{ name: 'HN', url: 'https://news.ycombinator.com' }],
    })

    expect(result?.title).toBe('AI 周报')
    expect(result?.titleCandidates).toEqual(['备选 A', '备选 B'])
    expect(result?.sources).toHaveLength(1)
  })
})

describe('resolveWriterOutput', () => {
  it('prefers step output over draft', () => {
    const result = resolveWriterOutput(
      {
        step: 'writer',
        status: 'succeeded',
        output: { title: '步骤标题', bodyMarkdown: '## A\n\n内容' },
      },
      {
        runStatus: 'succeeded',
        steps: [],
        contentDraft: { title: '草稿标题', bodyMarkdown: '草稿' },
      },
    )

    expect(result?.title).toBe('步骤标题')
  })
})

describe('markdown helpers', () => {
  it('counts ## sections', () => {
    expect(countMarkdownSections('## 一\n\n## 二')).toBe(2)
  })

  it('estimates word count without whitespace', () => {
    expect(estimateWordCount('hello world')).toBe(10)
  })
})
