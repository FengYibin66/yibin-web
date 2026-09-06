import { render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { describe, expect, it } from 'vitest'

import { ExperienceDetailView } from '@/components/classic/ExperienceDetailView'
import { en } from '@/lib/content/en'
import { zh } from '@/lib/content/zh'
import type { ExperienceItem } from '@/lib/content/types'

/**
 * 经历详情页页首的品牌标（2026-09-06）。
 *
 * 修的是一个实机 bug：McAllister 的 `company.jpg` 是一张 **225×225 的方形 logo**，
 * 却被塞进 `heroImage` 那个照片位——`w-full` + `object-cover` + `max-h-72`，在
 * `max-w-4xl`（896px）容器里等于把 225px 的方图放大约 4 倍到 896×896，再从中间
 * 裁出 288px 一条。结果：圆环上下被切掉、字母 M 只剩中段，还因为 4 倍放大而糊。
 *
 * 三件事叠在一起：
 *   1. `object-cover` 是给照片的裁切策略，logo 是有边界的图形，裁一刀就毁了；
 *   2. 它占了首屏近四成，说的却是紧邻上一行文字已经说过的事（公司名）；
 *   3. 225px 拉到 896px，怎么裁都是糊的。
 *
 * 修法不是调参数，是**认清这张图是什么**：它是 logo，就按 logo 呈现。
 * `TimelineItem.tsx:36` 早就有正确写法（40×40、`object-contain`、留白 + 底板），
 * 详情页复用同一套即可。
 */

const mcallister = en.experience.items.find((item) => item.id === 'mcallister')!

describe('经历详情页的品牌标', () => {
  it('logo 用 object-contain —— 绝不裁切', () => {
    render(<ExperienceDetailView item={mcallister} />, { wrapper: LocaleProvider })
    const logo = screen.getByTestId('experience-detail-logo')
    expect(logo.className).toContain('object-contain')
    expect(logo.className).not.toContain('object-cover')
  })

  it('logo 尺寸受控，不铺满整行', () => {
    /*
      定死宽高而不是 `w-full`：logo 的信息量和它占的面积无关，
      放大只会暴露它 225px 的底子。
    */
    render(<ExperienceDetailView item={mcallister} />, { wrapper: LocaleProvider })
    const logo = screen.getByTestId('experience-detail-logo')
    expect(logo.className).toMatch(/\bh-\d+\b/)
    expect(logo.className).toMatch(/\bw-\d+\b/)
    expect(logo.className).not.toContain('w-full')
  })

  it('没有 logo 的经历不渲染品牌标', () => {
    const withoutLogo: ExperienceItem = { ...mcallister, logo: undefined }
    render(<ExperienceDetailView item={withoutLogo} />, { wrapper: LocaleProvider })
    expect(screen.queryByTestId('experience-detail-logo')).toBeNull()
  })

  it('那张方形 logo 不再喂给照片位 —— 中英两份都不许', () => {
    /*
      断言的是数据，不是样式：只要 `heroImage` 还指着 company.jpg，
      换个组件写法照样会被裁。
    */
    for (const [name, site] of [['en', en], ['zh', zh]] as const) {
      const detail = site.experience.items.find((item) => item.id === 'mcallister')?.detail
      expect(detail, `${name} 的 mcallister 应当有 detail`).toBeDefined()
      expect(detail?.heroImage ?? '', `${name} 不该把方形 logo 当 heroImage`).not.toContain(
        'company.jpg',
      )
    }
  })

  it('品牌信息没丢 —— 公司名仍在，logo 作为标识仍在', () => {
    render(<ExperienceDetailView item={mcallister} />, { wrapper: LocaleProvider })
    expect(screen.getByText(new RegExp(mcallister.company))).toBeInTheDocument()
    expect(screen.getByTestId('experience-detail-logo')).toHaveAttribute(
      'src',
      expect.stringContaining('company.jpg'),
    )
  })
})
