import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectCard } from '@/components/ui/ProjectCard'
import type { ProjectItem } from '@/lib/content/types'

/**
 * 项目卡的「可点外观」必须和「真的可点」一致（2026-09-06）。
 *
 * 修的是一个实机 bug：卡片**无条件**带 `cursor-pointer` 和 hover 的 3D 倾斜 +
 * 光晕，但只有 `item.url` 存在时才包一层 `<a>`。全站 16 张项目卡里只有 3 张有
 * url，剩下 13 张摆着手型光标、hover 还会翘起来，点下去什么都不发生。
 *
 * 手型光标是一个承诺。没有目的地就不要做出这个承诺——不是"点了没反应"这种
 * 小瑕疵，是 UI 在说谎，用户会以为是页面卡死了（这次就是这么被发现的）。
 */

const base: ProjectItem = {
  name: 'HS2 衬砌与临建工程',
  description: '欧洲最大基础设施项目 HS2',
  tech: ['FEA', 'Python'],
  status: 'archive',
}

function cardElement(): HTMLElement {
  const card = document.querySelector('.glass-card')
  if (!(card instanceof HTMLElement)) throw new Error('没渲染出卡片')
  /*
    jsdom 里 `getBoundingClientRect()` 恒返回全零，倾斜公式除以 `rect.height / 2`
    会算出 NaN，`rotateX(NaNdeg)` 是非法值、浏览器直接丢弃 —— transform 于是
    永远是空串，"没翘"和"翘不动"分不出来。给个真实尺寸，断言才有意义。
  */
  card.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0 }) as DOMRect
  return card
}

describe('项目卡的可点外观', () => {
  describe('有 url —— 是真链接，该有可点外观', () => {
    it('包在 <a> 里并指向 url', () => {
      render(<ProjectCard item={{ ...base, url: 'https://www.getepic.com/' }} />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'https://www.getepic.com/')
    })

    it('带 cursor-pointer', () => {
      render(<ProjectCard item={{ ...base, url: 'https://www.getepic.com/' }} />)
      expect(cardElement().className).toContain('cursor-pointer')
    })

    it('hover 会翘起来（3D 倾斜仍在）', () => {
      render(<ProjectCard item={{ ...base, url: 'https://www.getepic.com/' }} />)
      const card = cardElement()
      fireEvent.mouseMove(card, { clientX: 10, clientY: 10 })
      expect(card.style.transform).toContain('rotate')
    })
  })

  describe('没有 url —— 不是链接，就不该假装可点', () => {
    it('不渲染成链接', () => {
      render(<ProjectCard item={base} />)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('不带 cursor-pointer', () => {
      render(<ProjectCard item={base} />)
      expect(cardElement().className).not.toContain('cursor-pointer')
    })

    it('hover 不翘、不发光 —— 没有目的地就不要给出可交互的暗示', () => {
      render(<ProjectCard item={base} />)
      const card = cardElement()
      fireEvent.mouseMove(card, { clientX: 10, clientY: 10 })
      fireEvent.mouseEnter(card)
      expect(card.style.transform).toBe('')
      expect(card.style.boxShadow).toBe('')
    })
  })

  it('两种形态都照常渲染内容 —— 去掉的只是假承诺，不是信息', () => {
    const { unmount } = render(<ProjectCard item={base} />)
    expect(screen.getByText(base.name)).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
    unmount()

    render(<ProjectCard item={{ ...base, url: 'https://example.com/' }} />)
    expect(screen.getByText(base.name)).toBeInTheDocument()
  })
})
