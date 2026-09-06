import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { en } from '@/lib/content/en'

/**
 * 项目区块的链接接线（2026-09-06）。
 *
 * 两件事一起测，因为它们是同一个 bug 的两面：
 *
 * 1. 分类标题在有经历详情时要能点进去。McAllister 的 summary 写着「详情见工作
 *    经历」，详情页也确实存在，但此前没有任何地方链过去——那句话成了死路标。
 *    做在**分类标题**上而不是卡片上：卡片是内容展示，跳去「工作经历」属于组级
 *    导航，一张项目卡把人送去经历页语义上是拧的。
 *
 * 2. 用真实数据兜底：页面上任何带手型光标的卡片都必须真的能点。上一版就是靠
 *    人肉点击才发现 13 张卡在撒谎，这条断言让数据变更也能被挡住——将来给某张
 *    卡加 url 或去掉 url，不需要有人记得再点一遍。
 */
describe('项目区块的链接', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('McAllister 分类标题链到它的经历详情页', () => {
    render(<ProjectsSection />, { wrapper: LocaleProvider })
    const link = screen.getByRole('link', { name: /McAllister/ })
    /*
      末尾斜杠这里放宽：`next.config` 是 `trailingSlash: true`，实际产出确实是
      `/classic/experience/mcallister/`（curl 过 `/classic/` 核对），但 jsdom 里
      `next/link` 不跑构建期那层归一化，渲染出来没有斜杠。
      精确串由 `projectCategoryDetail.test.ts` 钉住，这里只管接线对不对。
    */
    expect(link.getAttribute('href')).toMatch(/^\/classic\/experience\/mcallister\/?$/)
  })

  it('没有经历详情的分类，标题保持纯文本', () => {
    render(<ProjectsSection />, { wrapper: LocaleProvider })
    const withoutDetail = en.projects.categories.filter((category) => category.id !== 'mcallister')
    expect(withoutDetail.length).toBeGreaterThan(0)

    for (const category of withoutDetail) {
      expect(
        screen.queryByRole('link', { name: category.title }),
        `分类「${category.title}」不该是链接`,
      ).toBeNull()
      expect(screen.getByText(category.title)).toBeInTheDocument()
    }
  })

  it('真实数据：页面上每一张带手型光标的卡片都真的能点', () => {
    const { container } = render(<ProjectsSection />, { wrapper: LocaleProvider })

    const cards = Array.from(container.querySelectorAll('.glass-card'))
    expect(cards.length, '一张卡都没渲染出来的话这条断言是空的').toBeGreaterThan(0)

    const lying = cards.filter(
      (card) => card.className.includes('cursor-pointer') && card.closest('a') === null,
    )
    expect(lying.map((card) => card.textContent?.slice(0, 20)), '这些卡有手型光标却不可点').toEqual([])
  })
})
