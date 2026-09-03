import { fireEvent, render, screen } from '@testing-library/react'
import { content } from '@/lib/content'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

const sceneMocks = vi.hoisted(() => ({
  roomLoadState: {
    phase: 'idle',
    roomId: null,
    segmentIndex: null,
    attempt: 0,
    error: null,
  } as RoomLoadState,
  retryRoomLoad: vi.fn(),
  resetRoomLoad: vi.fn(),
}))

const roomAssetMocks = vi.hoisted(() => ({
  reloadRoomAssets: vi.fn(),
}))

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="lab-canvas" />,
}))

vi.mock('gsap', () => ({
  default: { registerPlugin: vi.fn() },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {},
}))

vi.mock('@/context/SceneContext', () => ({
  SceneProvider: ({ children }: { children: ReactNode }) => children,
  useScene: () => ({
    isInRoom: false,
    markEntered: vi.fn(),
    roomLoadState: sceneMocks.roomLoadState,
    retryRoomLoad: sceneMocks.retryRoomLoad,
    resetRoomLoad: sceneMocks.resetRoomLoad,
  }),
}))

vi.mock('@/context/PerformanceContext', () => ({
  PerformanceProvider: ({ children }: { children: ReactNode }) => children,
  usePerformance: () => ({ settings: { antialias: false, dpr: 1 } }),
}))

vi.mock('@/context/AudioContext', () => ({
  AudioProvider: ({ children }: { children: ReactNode }) => children,
  useAudio: () => ({ playBgm: vi.fn(), stopBgm: vi.fn() }),
}))

vi.mock('@/context/AchievementsContext', () => ({
  AchievementsProvider: ({ children }: { children: ReactNode }) => children,
  useAchievements: () => ({ unlockAchievement: vi.fn() }),
}))

vi.mock('@/hooks/useWheelRouter', () => ({
  WheelRouterProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/hooks/useCorridorCamera', () => ({
  useCorridorCamera: () => ({ setCameraOverride: vi.fn() }),
}))

vi.mock('@/components/lab/InfiniteCorridorManager', () => ({
  InfiniteCorridorManager: () => null,
}))

vi.mock('@/components/lab/PaperTransition', () => ({
  PaperTransition: () => null,
}))

vi.mock('@/components/lab/TeleportRoom', () => ({
  TeleportRoom: () => null,
}))

vi.mock('@/components/lab/LabTutorial', () => ({
  LabTutorial: () => null,
}))

vi.mock('@/components/ui/NavigationUI', () => ({
  NavigationUI: () => <div data-testid="navigation-ui" />,
}))

vi.mock('@/lib/lab/texturePreload', () => ({
  preloadCorridorTextures: vi.fn(),
}))

vi.mock('@/lib/lab/roomAssets', () => ({
  reloadRoomAssets: roomAssetMocks.reloadRoomAssets,
}))

import { LabScene } from '@/components/lab/LabScene'
import { RoomLoadingIndicator } from '@/components/lab/RoomLoadingIndicator'

const LOADING_STATE: RoomLoadState = {
  phase: 'loading',
  roomId: 'publications',
  segmentIndex: 0,
  attempt: 1,
  error: null,
}

const FAILED_STATE: RoomLoadState = {
  phase: 'failed',
  roomId: 'publications',
  segmentIndex: 0,
  attempt: 1,
  error: 'Room assets timed out',
}


/*
  Lab 的界面组件接了 i18n（审计 E7）后必须包 `LocaleProvider`。

  `LocaleContext` 的默认值是访问即抛异常的对象——设计意图是让"忘了包
  Provider"立刻失败而不是静默拿到错误语言（见 apps/resume/AGENTS.md
  「测试环境的两个坑」）。
*/

describe('RoomLoadingIndicator', () => {
  it('announces the active room while loading', () => {
    render(
      <RoomLoadingIndicator
        state={LOADING_STATE}
        onRetry={vi.fn()}
        onBack={vi.fn()}
      />,
    { wrapper: LocaleProvider })

    /*
      断言的是**文案表里的值**，不是写死的英文串。

      文案已经本地化（审计 E7），把 'Preparing Publications…' 写死在测试里
      有两个问题：改文案就要改测试（而文案本来就会改），以及它只覆盖英文。
      从 content 取值则两种语言都受这条保护。
    */
    const labels = content.en.labUi
    expect(
      screen.getByText(`${labels.loading.preparing} · ${labels.doors.publications}`),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the failure and reports recovery actions', () => {
    const onRetry = vi.fn()
    const onBack = vi.fn()

    render(
      <RoomLoadingIndicator
        state={FAILED_STATE}
        onRetry={onRetry}
        onBack={onBack}
      />,
    { wrapper: LocaleProvider })

    // 标题是本地化文案，原始技术串降为次要细节行（两者都要在）
    expect(screen.getByText(content.en.labUi.loading.failedHint)).toBeVisible()
    expect(screen.getByText('Room assets timed out')).toBeVisible()
    const retryButton = screen.getByRole('button', { name: content.en.labUi.loading.retry })
    const backButton = screen.getByRole('button', { name: content.en.labUi.loading.backToCorridor })
    expect(retryButton).toBeEnabled()
    expect(backButton).toBeEnabled()

    fireEvent.click(retryButton)
    fireEvent.click(backButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders nothing outside aligning, loading, and failed phases', () => {
    const { container } = render(
      <RoomLoadingIndicator
        state={{ ...LOADING_STATE, phase: 'ready' }}
        onRetry={vi.fn()}
        onBack={vi.fn()}
      />,
    { wrapper: LocaleProvider })

    expect(container).toBeEmptyDOMElement()
  })
})

describe('LabScene room loading indicator', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    sceneMocks.retryRoomLoad.mockReset()
    sceneMocks.resetRoomLoad.mockReset()
    roomAssetMocks.reloadRoomAssets.mockReset()
    sceneMocks.roomLoadState = FAILED_STATE
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts between the canvas and navigation and forwards scene actions', () => {
    render(<LabScene />, { wrapper: LocaleProvider })

    const canvas = screen.getByTestId('lab-canvas')
    const indicator = screen.getByRole('alert')
    const navigation = screen.getByTestId('navigation-ui')
    expect(canvas.compareDocumentPosition(indicator)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(indicator.compareDocumentPosition(navigation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )

    fireEvent.click(screen.getByRole('button', { name: content.en.labUi.loading.retry }))
    fireEvent.click(screen.getByRole('button', { name: content.en.labUi.loading.backToCorridor }))
    expect(roomAssetMocks.reloadRoomAssets).toHaveBeenCalledWith('publications')
    expect(sceneMocks.retryRoomLoad).toHaveBeenCalledTimes(1)
    expect(
      roomAssetMocks.reloadRoomAssets.mock.invocationCallOrder[0],
    ).toBeLessThan(sceneMocks.retryRoomLoad.mock.invocationCallOrder[0])
    expect(sceneMocks.resetRoomLoad).toHaveBeenCalledTimes(1)
  })

  it('does not run ordinary-room asset reload for gallery retries', () => {
    sceneMocks.roomLoadState = {
      ...FAILED_STATE,
      roomId: 'gallery',
    }
    render(<LabScene />, { wrapper: LocaleProvider })

    fireEvent.click(screen.getByRole('button', { name: content.en.labUi.loading.retry }))

    expect(roomAssetMocks.reloadRoomAssets).not.toHaveBeenCalled()
    expect(sceneMocks.retryRoomLoad).toHaveBeenCalledTimes(1)
  })
})
