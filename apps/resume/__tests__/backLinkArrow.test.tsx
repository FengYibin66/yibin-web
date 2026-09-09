import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { ClassicBackLink } from '@/components/classic/ClassicBackLink'
import { en } from '@/lib/content/en'
import { zh } from '@/lib/content/zh'

/**
 * 返回链接的箭头恰好一个。
 *
 * 装饰性字符不住在本地化文案里：文案是裸的，`←` 由组件渲染。
 *
 * 断言在**渲染结果**上而不是文案上，两个理由：断言「文案不含 `←`」守不住反向的错
 * （箭头从组件里删掉、加回文案，它照样绿）；而且会诱使人写一份全局规则
 * 「文案不含方向箭头」，而 `labUi.fallback.webglCta` 等键合法地含 `→`。
 */
function renderCount(node: React.ReactElement, glyph: string): number {
  render(<LocaleProvider>{node}</LocaleProvider>)
  const link = screen.getByTestId('classic-back-link')
  return (link.textContent ?? '').split(glyph).length - 1
}

describe('返回链接的箭头恰好一个', () => {
  it('ClassicBackLink 渲染出的 ← 只有一个', () => {
    expect(renderCount(<ClassicBackLink />, '←')).toBe(1)
  })

  it('两种语言的文案本身都不带 ←（箭头由组件提供）', () => {
    // 这一条不是为了守文案，而是为了在失败时**指出是哪一侧多了箭头**——
    // 上面那条只会说"有两个"，这条会说"文案里也有一个"。
    expect(en.classicUi.backToClassic).not.toContain('←')
    expect(zh.classicUi.backToClassic).not.toContain('←')
  })

  it('论文详情页底部那个调用点的写法与 ClassicBackLink 一致', () => {
    // 底部返回不在 ClassicBackLink 里（它是页内的第二个返回，形态是 pill），
    // 所以按源码断言：`← {` 后面必须紧跟 backToClassic，且整行只有一个箭头。
    // 用源码而非渲染，是因为把整个 PublicationDetailView 渲染起来要造一整份论文数据，
    // 而这里要守的只是那一行的写法。
    const src = readSource('components/classic/PublicationDetailView.tsx')
    const lines = src.split('\n').filter(l => l.includes('backToClassic'))
    expect(lines.length, 'PublicationDetailView 里应当只有一处 backToClassic').toBe(1)
    expect((lines[0]!.match(/←/g) ?? []).length, `箭头应当只有一个：${lines[0]!.trim()}`).toBe(1)
  })
})

function readSource(rel: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve } = require('node:path') as typeof import('node:path')
  return readFileSync(resolve(__dirname, '..', rel), 'utf8')
}
