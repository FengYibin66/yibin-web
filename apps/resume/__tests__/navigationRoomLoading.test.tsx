import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoomLoadPhase, RoomLoadState } from '@/lib/lab/roomLoadMachine'

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
}))

vi.mock('@/components/ui/AchievementPopup', () => ({
  AchievementPopup: () => null,
}))

vi.mock('@/components/ui/AchievementsPanel', () => ({
  AchievementsPanel: () => null,
}))

import { NavigationUI } from '@/components/ui/NavigationUI'

const BLOCKED_PHASES: RoomLoadPhase[] = [
  'aligning',
  'loading',
  'ready',
  'opening',
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
      render(<NavigationUI />)

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
      render(<NavigationUI />)

      fireEvent.click(screen.getByRole('button', { name: 'Open map' }))
      expect(screen.getByRole('button', { name: 'Projects' })).toBeEnabled()
    },
  )

  it('disables Back accessibly while teleporting from an entered room', () => {
    setRoomLoadPhase('entered')
    sceneMocks.isTeleporting = true
    render(<NavigationUI />)

    const backButton = screen.getByRole('button', { name: 'Back to corridor' })
    expect(backButton).toBeDisabled()
    expect(backButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(backButton)
    expect(sceneMocks.requestExit).not.toHaveBeenCalled()
  })

  it('requests exit from Back while entered and not teleporting', () => {
    setRoomLoadPhase('entered')
    render(<NavigationUI />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to corridor' }))

    expect(sceneMocks.requestExit).toHaveBeenCalledTimes(1)
  })
})
