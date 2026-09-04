import { fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/lib/content/en'
import { zh } from '@/lib/content/zh'
import { nextLocaleLabel } from '@/lib/content/localeToggle'

/**
 * Lab 顶栏的语言切换（2026-09-04）。
 *
 * Lab 是全站唯一没有 Navbar 的视图，所以此前是唯一切不了语言的地方——用户进了
 * 走廊看到门牌才想换语言，却得退回入口页。按钮复用 `useLocale().toggle` 与
 * `nextLocaleLabel`，不另写逻辑；这里测的是**接线**：按钮在、点了真的切、
 * 并且和 Classic 页那个按钮显示同一套文字。
 */

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    hasEntered: true,
    isInRoom: false,
    currentRoom: null,
    requestExit: vi.fn(),
    teleportTo: vi.fn(),
    isTeleporting: false,
    roomLoadState: { phase: 'idle', roomId: null, segmentIndex: null, attempt: 0, error: null },
  }),
}))

vi.mock('@/context/AudioContext', () => ({
  useAudio: () => ({
    isMuted: false, toggleMute: vi.fn(),
    sfxVolume: 0.5, setSfxVolume: vi.fn(),
    bgmVolume: 0.5, setBgmVolume: vi.fn(),
  }),
}))

vi.mock('@/context/AchievementsContext', () => {
  const mocked = { useAchievements: () => ({ showTutorial: vi.fn(), unlockAchievement: vi.fn() }) }
  return { ...mocked, useAchievementActions: mocked.useAchievements }
})

vi.mock('@/components/ui/AchievementPopup', () => ({ AchievementPopup: () => null }))
vi.mock('@/components/ui/AchievementsPanel', () => ({ AchievementsPanel: () => null }))

import { NavigationUI } from '@/components/ui/NavigationUI'

describe('Lab 顶栏语言切换', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('按钮在顶栏里，默认（英文界面）显示「中文」', () => {
    render(<NavigationUI />, { wrapper: LocaleProvider })
    const button = screen.getByTestId('nav-locale')
    expect(button).toHaveTextContent(nextLocaleLabel('en'))
    // 标签用目标语言写：英文界面上是中文的"切换到中文"
    expect(button).toHaveAttribute('aria-label', en.labUi.panels.toggleLanguage)
  })

  it('点一下切到中文：按钮文字、aria-label、<html lang> 同时变', () => {
    render(<NavigationUI />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('nav-locale'))

    const button = screen.getByTestId('nav-locale')
    expect(button).toHaveTextContent(nextLocaleLabel('zh'))
    expect(button).toHaveAttribute('aria-label', zh.labUi.panels.toggleLanguage)
    expect(document.documentElement.lang).toBe('zh')
    // 其余按钮的标签跟着切 —— 不是只有这个按钮自己变了
    expect(screen.getByTestId('nav-map')).toHaveAttribute('aria-label', zh.labUi.panels.openMap)
  })

  it('切换写进 resume-locale —— 与 Classic / 入口页共用同一份偏好', () => {
    render(<NavigationUI />, { wrapper: LocaleProvider })
    fireEvent.click(screen.getByTestId('nav-locale'))
    expect(window.localStorage.getItem('resume-locale')).toBe('zh')
  })

  it('与 Classic 页的 LocaleToggle 显示同一套文字 —— 两处按钮共用一个规则', () => {
    expect(nextLocaleLabel('en')).toBe('中文')
    expect(nextLocaleLabel('zh')).toBe('EN')
  })
})
