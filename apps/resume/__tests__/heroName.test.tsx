import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { ClassicPanel } from '@/components/entry/ClassicPanel'
import { heroNames } from '@/lib/content/heroName'
import { en } from '@/lib/content/en'
import { zh } from '@/lib/content/zh'

/**
 * 名字按语言切主次（2026-09-07 实机反馈：「这中文，但是我这名字怎么是英文」）。
 *
 * 数据里 `hero.name` 是英文名、`hero.nameZh` 是中文名，两份 locale 都一样——名字
 * 本身不翻译。此前门户的 Classic 面板只读 `name`，Classic 首屏永远英文大、中文小：
 * 切到中文后，标题、眉题、标签全是中文，唯独名字还是 Yibin Feng。
 *
 * 规则收在一个纯函数里：zh 主中文副英文，en 主英文副中文。两个使用方（门户面板、
 * Classic 首屏）都走它，不各写一个三目。
 */
describe('heroNames', () => {
  it('zh：主中文，副英文', () => {
    expect(heroNames(zh.hero, 'zh')).toEqual({ primary: '冯一镔', secondary: 'Yibin Feng' })
  })
  it('en：主英文，副中文', () => {
    expect(heroNames(en.hero, 'en')).toEqual({ primary: 'Yibin Feng', secondary: '冯一镔' })
  })
})

describe('门户 Classic 面板的名字', () => {
  beforeEach(() => window.localStorage.clear())

  it('中文界面下 h1 是中文名，英文名退为副名', () => {
    window.localStorage.setItem('resume-locale', 'zh')
    render(<ClassicPanel />, { wrapper: LocaleProvider })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('冯一镔')
    expect(screen.getByTestId('classic-panel-secondary-name')).toHaveTextContent('Yibin Feng')
  })

  it('英文界面下 h1 是英文名', () => {
    render(<ClassicPanel />, { wrapper: LocaleProvider })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yibin Feng')
    expect(screen.getByTestId('classic-panel-secondary-name')).toHaveTextContent('冯一镔')
  })
})
