import { fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoomLoadPhase, RoomLoadState } from '@/context/SceneContext'

const sceneMocks = vi.hoisted(() => ({
  currentRoom: null as 'publications' | null,
  roomLoadState: {
    phase: 'idle',
    roomId: null,
    segmentIndex: null,
    attempt: 0,
    error: null,
  } as RoomLoadState,
  isTeleporting: false,
  requestExit: vi.fn(),
  teleportTo: vi.fn(),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    hasEntered: true,
    isInRoom: sceneMocks.currentRoom !== null,
    currentRoom: sceneMocks.currentRoom,
    requestExit: sceneMocks.requestExit,
    teleportTo: sceneMocks.teleportTo,
    isTeleporting: sceneMocks.isTeleporting,
    roomLoadState: sceneMocks.roomLoadState,
  }),
}))

vi.mock('@/context/AudioContext', () => ({
  useAudio: () => ({
    isMuted: false,
    toggleMute: vi.fn(),
    sfxVolume: 0.5,
    setSfxVolume: vi.fn(),
    bgmVolume: 0.5,
    setBgmVolume: vi.fn(),
  }),
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({
    showTutorial: vi.fn(),
    unlockAchievement: vi.fn(),
  }),
  // NavigationUI 只用动作，走的是不随队列变化的那个 context
  useAchievementActions: () => ({
    showTutorial: vi.fn(),
    unlockAchievement: vi.fn(),
  }),
}))

vi.mock('@/components/ui/AchievementPopup', () => ({
  AchievementPopup: () => null,
}))

vi.mock('@/components/ui/AchievementsPanel', () => ({
  AchievementsPanel: () => null,
}))

import { NavigationUI } from '@/components/ui/NavigationUI'

/*
  `opening` 换成了 `mounting`（ADR 20260903211338 接线状态图时）。

  这不是重命名：旧 reducer 的 `opening` 表示"门板正在开"，而**没有任何消费方
  区分过它与 `ready`**；机器新增的 `mounting` 表示"房间子树挂了、纹理还没开始
  加载"，旧实现只能靠 `showRoom` 那个组件局部 state 判断。两者都属于"不该让
  用户点导航"的相位，所以这张表的语义不变。
*/
const BLOCKED_PHASES: RoomLoadPhase[] = [
  'aligning',
  'mounting',
  'loading',
  'ready',
  'failed',
  'exiting',
]

function setRoomLoadPhase(phase: RoomLoadPhase): void {
  sceneMocks.roomLoadState = {
    phase,
    roomId: phase === 'idle' ? null : 'publications',
    segmentIndex: phase === 'idle' ? null : 0,
    attempt: phase === 'idle' ? 0 : 1,
    error: phase === 'failed' ? 'failed' : null,
  }
  sceneMocks.currentRoom = phase === 'entered' ? 'publications' : null
}


/*
  Lab 的界面组件接了 i18n（审计 E7）后必须包 `LocaleProvider`。

  `LocaleContext` 的默认值是访问即抛异常的对象——设计意图是让"忘了包
  Provider"立刻失败而不是静默拿到错误语言（见 apps/resume/AGENTS.md
  「测试环境的两个坑」）。
*/

describe('NavigationUI room loading guard', () => {
  beforeEach(() => {
    sceneMocks.isTeleporting = false
    sceneMocks.requestExit.mockReset()
    sceneMocks.teleportTo.mockReset()
  })

  it.each(BLOCKED_PHASES)(
    'disables map room buttons during the %s phase',
    (phase) => {
      setRoomLoadPhase(phase)
      render(<NavigationUI />, { wrapper: LocaleProvider })

      fireEvent.click(screen.getByRole('button', { name: 'Open map' }))
      const projectsButton = screen.getByRole('button', { name: 'Projects' })

      expect(projectsButton).toBeDisabled()
      expect(projectsButton).toHaveAttribute('aria-disabled', 'true')
      fireEvent.click(projectsButton)
      expect(sceneMocks.teleportTo).not.toHaveBeenCalled()
    },
  )

  it.each(['idle', 'entered'] as const)(
    'keeps map room buttons enabled during the %s phase',
    (phase) => {
      setRoomLoadPhase(phase)
      render(<NavigationUI />, { wrapper: LocaleProvider })

      fireEvent.click(screen.getByRole('button', { name: 'Open map' }))
      expect(screen.getByRole('button', { name: 'Projects' })).toBeEnabled()
    },
  )

  it('disables Back accessibly while teleporting from an entered room', () => {
    setRoomLoadPhase('entered')
    sceneMocks.isTeleporting = true
    render(<NavigationUI />, { wrapper: LocaleProvider })

    const backButton = screen.getByRole('button', { name: 'Back to corridor' })
    expect(backButton).toBeDisabled()
    expect(backButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(backButton)
    expect(sceneMocks.requestExit).not.toHaveBeenCalled()
  })

  it('requests exit from Back while entered and not teleporting', () => {
    setRoomLoadPhase('entered')
    render(<NavigationUI />, { wrapper: LocaleProvider })

    fireEvent.click(screen.getByRole('button', { name: 'Back to corridor' }))

    expect(sceneMocks.requestExit).toHaveBeenCalledTimes(1)
  })
})
