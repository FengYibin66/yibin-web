import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import type { ProjectRoomItem } from '@/lib/content/projectsRoom'

/**
 * Projects 房间：停靠的显示器上要有「访问 →」出口（2026-09-06）。
 *
 * ADR 20260903140616 把「点一下」统一成停靠（浏览 → 居中 → 停靠 → 收回），
 * 原实现的 `window.open` 被替掉了。那一步是对的——两个房间里点一下的含义
 * 一致。但 `ProjectRoomItem.url` 一路带到房间却**没有任何地方消费**：有链接的
 * 三个项目停靠后也无路可去。用户点了显示器问「没跳转，是正确的吗」。
 *
 * 出口放在**停靠态的屏幕底部**，只在 `item.url` 存在时出现——和 Classic 项目卡
 * 同一条原则：没有目的地就不做出可点的承诺。文案走 `labUi.hints.visitProject`。
 */

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ camera: {}, gl: { domElement: document.createElement('div') }, scene: {} }),
}))

function fakeTexture(): Record<string, unknown> {
  return { wrapS: 0, wrapT: 0, repeat: { set: vi.fn() }, needsUpdate: false, clone: () => fakeTexture() }
}

/*
  `Text` 退化成一个可点的 DOM 元素，把 R3F 的 `onClick` 透传成 DOM click，
  这样"点『访问 →』会打开链接"能在 jsdom 里断言。其余 3D 图元退化成空标签。
*/
vi.mock('@react-three/drei', () => ({
  useTexture: (paths: string[]) => paths.map(() => fakeTexture()),
  Text: ({ children, onClick, ...rest }: { children?: React.ReactNode; onClick?: (e: unknown) => void }) => (
    <span
      data-testid={(rest as Record<string, unknown>)['data-testid'] as string | undefined}
      onClick={() => onClick?.({ stopPropagation: () => {} })}
    >
      {children}
    </span>
  ),
}))

vi.mock('@/lib/lab/app/audio/AudioMixer', () => ({
  audioMixer: { play: vi.fn() },
}))

const { ProjectMonitor } = await import('@/components/rooms/projects/ProjectMonitor')

const withUrl: ProjectRoomItem = {
  id: 'resume-0',
  title: 'Resume Site',
  sub: 'Three.js · GSAP · Next.js',
  url: 'https://resume.yibinfeng.com/',
  tech: ['Three.js', 'GSAP', 'Next.js'],
  description: 'Personal site',
}
const withoutUrl: ProjectRoomItem = { ...withUrl, id: 'internal-1', url: undefined }

function renderMonitor(item: ProjectRoomItem, isSelected: boolean) {
  return render(
    <ProjectMonitor item={item} index={0} count={3} isSelected={isSelected} isDimmed={false} onSelect={vi.fn()} />,
    { wrapper: LocaleProvider },
  )
}

describe('停靠显示器上的「访问 →」', () => {
  let open: ReturnType<typeof vi.fn>
  beforeEach(() => {
    open = vi.fn()
    vi.stubGlobal('open', open)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('停靠且有 url —— 显示出口，点了新开标签', () => {
    renderMonitor(withUrl, true)
    const visit = screen.getByTestId('monitor-visit')
    expect(visit).toHaveTextContent('Visit')
    fireEvent.click(visit)
    expect(open).toHaveBeenCalledWith(withUrl.url, '_blank', 'noopener,noreferrer')
  })

  it('没停靠 —— 不显示出口（浏览态点一下仍是停靠，不是跳转）', () => {
    renderMonitor(withUrl, false)
    expect(screen.queryByTestId('monitor-visit')).toBeNull()
  })

  it('停靠但没有 url —— 不显示出口，不做没有目的地的承诺', () => {
    renderMonitor(withoutUrl, true)
    expect(screen.queryByTestId('monitor-visit')).toBeNull()
  })

  it('出口文案来自 labUi，中文下是「访问」', () => {
    window.localStorage.setItem('resume-locale', 'zh')
    renderMonitor(withUrl, true)
    expect(screen.getByTestId('monitor-visit')).toHaveTextContent('访问')
    window.localStorage.clear()
  })
})
