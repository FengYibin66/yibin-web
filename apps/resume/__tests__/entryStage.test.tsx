import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { content } from '@/lib/content'

/**
 * 入口页手机端的静态门（审计的入口页渐进方案）。
 *
 * 入口页原本要先下 1553 KB 的脚本（three.js + R3F）再编译 shader 才能画出
 * 那扇门；手机访客为了一扇**静止的门**下载整个 3D 运行时。
 * `EntryStage` 在 coarse pointer + 窄屏时渲染一张 54 KB 的静态首帧，
 * 完全不挂 Canvas——实测手机端 3871 → 856 KB。
 *
 * 这一组要守的是三件"坏了不报错"的事：
 *
 *   1. 判据必须**两个条件都要**（coarse pointer 且窄屏）。只看宽度会让拖窄
 *      的桌面窗口掉进静态路径，只看 pointer 会让 iPad 横屏掉进去。
 *   2. 门必须是真链接。它是手机端**唯一**的进入口，做成 div+onClick 就等于
 *      键盘用户进不去（审计 E3 的同一条）。
 *   3. JS 没跑起来时要退化成普通链接直接跳，而不是一张点不动的图。
 */

const ROOT = join(import.meta.dirname, '..')
const FIRST_FRAME = join(ROOT, 'public/entry/door-firstframe.webp')

const mocks = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))

let matchMediaResult = false
let innerWidth = 1440

function setViewport({ coarse, width }: { coarse: boolean; width: number }) {
  matchMediaResult = coarse
  innerWidth = width
}

beforeEach(() => {
  mocks.push.mockClear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse') ? matchMediaResult : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    get: () => innerWidth,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const DESKTOP_MARKER = 'desktop-3d-scene'

async function mount() {
  const { EntryStage } = await import('@/components/entry/EntryStage')
  return render(
    <EntryStage>
      <div data-testid={DESKTOP_MARKER} />
    </EntryStage>,
    { wrapper: LocaleProvider },
  )
}

describe('路径判定', () => {
  it('coarse pointer + 窄屏 → 静态图，不渲染 3D', async () => {
    setViewport({ coarse: true, width: 390 })
    await mount()
    expect(screen.queryByTestId(DESKTOP_MARKER), '手机端仍然挂了 3D 场景').toBeNull()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/lab')
  })

  it('细指针（鼠标）+ 窄屏 → 仍走 3D —— 拖窄的桌面窗口有能力跑', async () => {
    setViewport({ coarse: false, width: 390 })
    await mount()
    expect(screen.getByTestId(DESKTOP_MARKER)).toBeInTheDocument()
  })

  it('coarse pointer + 宽屏 → 仍走 3D —— iPad 横屏屏幕够大、性能也够', async () => {
    setViewport({ coarse: true, width: 1180 })
    await mount()
    expect(screen.getByTestId(DESKTOP_MARKER)).toBeInTheDocument()
  })

  it('桌面 → 3D', async () => {
    setViewport({ coarse: false, width: 1440 })
    await mount()
    expect(screen.getByTestId(DESKTOP_MARKER)).toBeInTheDocument()
  })
})

describe('静态门的交互', () => {
  beforeEach(() => setViewport({ coarse: true, width: 390 }))

  it('是真链接 —— 它是手机端唯一的进入口，键盘必须能到（审计 E3）', async () => {
    await mount()
    const link = screen.getByRole('link')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/lab')
    expect(link).toHaveAttribute('aria-label')
  })

  it('点击先播动画、再跳转 —— 立刻跳会看不到开门', async () => {
    vi.useFakeTimers()
    await mount()
    fireEvent.click(screen.getByRole('link'))

    expect(mocks.push, '点了就立刻跳，开门动画没机会播').not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(mocks.push).toHaveBeenCalledWith('/lab')
  })

  it('连点只跳一次 —— 不去重的话返回时要按两下才回到入口页', async () => {
    vi.useFakeTimers()
    await mount()
    const link = screen.getByRole('link')
    fireEvent.click(link)
    fireEvent.click(link)
    fireEvent.click(link)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(mocks.push).toHaveBeenCalledTimes(1)
  })

  it('文案走 i18n，不是硬编码英文（审计 E7）', async () => {
    await mount()
    const labels = content.en.labUi.entry
    expect(screen.getByText(labels.labTitle)).toBeVisible()
    expect(screen.getByText(labels.labTagline)).toBeVisible()
    expect(screen.getByText(labels.labCtaTouch)).toBeVisible()
  })

  it('静态首帧是首屏内容，不能懒加载', async () => {
    await mount()
    const img = screen.getByRole('link').querySelector('img')!
    expect(img.getAttribute('loading'), '懒加载会让首屏空着').toBe('eager')
    expect(img.getAttribute('src')).toContain('door-firstframe')
  })

  it('图片 alt 为空 —— 它是装饰，语义由链接的 aria-label 承担', async () => {
    await mount()
    // 有内容的 alt 会让读屏软件把"一扇门的照片"念一遍，再念一次链接标签
    expect(screen.getByRole('link').querySelector('img')).toHaveAttribute('alt', '')
  })
})

describe('静态首帧产物', () => {
  it('文件存在 —— 不存在的话手机端是一块空白', () => {
    expect(
      existsSync(FIRST_FRAME),
      '跑 pnpm build && node scripts/media/entry-firstframe.mjs',
    ).toBe(true)
  })

  it('足够小 —— 它的意义就是替掉 1553 KB 的 3D 运行时', () => {
    const kb = statSync(FIRST_FRAME).size / 1024
    expect(kb, `${kb.toFixed(0)} KB，太大了`).toBeLessThan(120)
  })
})
