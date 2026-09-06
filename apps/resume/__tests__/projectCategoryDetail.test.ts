import { describe, expect, it } from 'vitest'

import { projectCategoryDetailHref } from '@/lib/content/projectCategoryDetail'
import { en } from '@/lib/content/en'
import { zh } from '@/lib/content/zh'
import type { ExperienceItem } from '@/lib/content/types'

/**
 * 项目分类标题 → 对应经历详情页的链接（2026-09-06）。
 *
 * 起因：McAllister 分类的 summary 写着「详情见工作经历」，而
 * `/classic/experience/mcallister/` 这个详情页**确实存在**（`mcallisterDetail.ts`），
 * 只是没有任何地方链过去——用户点了那张 HS2 卡片，什么也没发生。
 *
 * 规则与 `TimelineItem.tsx:15` 完全一致：**有 `detail` 才给链接，没有就不给**。
 * 抽成纯函数是因为这条规则现在有两个使用方（时间轴、项目分类标题），
 * 各写一遍就会在「哪些经历算有详情」上分叉。
 */

function fakeExperience(items: Array<Partial<ExperienceItem> & { id: string }>): ExperienceItem[] {
  return items.map((item) => ({
    company: 'C',
    role: 'R',
    period: 'P',
    location: 'L',
    bullets: [],
    ...item,
  }))
}

describe('projectCategoryDetailHref', () => {
  it('id 对得上且那条经历写了 detail —— 给链接', () => {
    const experience = fakeExperience([
      { id: 'mcallister', detail: { sections: [] } as never },
    ])
    expect(projectCategoryDetailHref('mcallister', experience)).toBe(
      '/classic/experience/mcallister/',
    )
  })

  it('id 对得上但那条经历没有 detail —— 不给链接', () => {
    /*
      这一条是重点：详情页路由对所有经历 id 都存在（`generateStaticParams`
      遍历的是全部 experience），所以「路由能开」不等于「有内容可看」。
      判据必须是 detail 字段，否则会把人送进一个空页面。
    */
    const experience = fakeExperience([{ id: 'epic' }])
    expect(projectCategoryDetailHref('epic', experience)).toBeUndefined()
  })

  it('压根没有同 id 的经历 —— 不给链接', () => {
    const experience = fakeExperience([{ id: 'mcallister', detail: { sections: [] } as never }])
    expect(projectCategoryDetailHref('personal', experience)).toBeUndefined()
  })

  it('真实数据：中英两份内容里，只有 mcallister 这一个分类拿得到链接', () => {
    /*
      不写死"只有 mcallister"这句话本身，而是从数据算出来再断言，
      这样将来给别的经历补了 detail，测试会红在这里提醒同步预期。
    */
    for (const [name, site] of [['en', en], ['zh', zh]] as const) {
      const linked = site.projects.categories
        .map((category) => category.id)
        .filter((id) => projectCategoryDetailHref(id, site.experience.items) !== undefined)
      expect(linked, `${name} 里能链到经历详情的分类`).toEqual(['mcallister'])
    }
  })
})
