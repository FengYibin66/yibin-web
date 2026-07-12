import { render } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectsRoom } from '@/components/rooms/ProjectsRoom'

const mocks = vi.hoisted(() => ({
  roomPhase: 'loading',
  gsapTo: vi.fn(),
  tweenKill: vi.fn(),
  camera: { position: { x: 0, y: 0, z: 0 } },
  router: {
    subscribe: vi.fn(() => vi.fn()),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}))

vi.mock('@react-three/fiber', () => ({
  extend: vi.fn(),
  useFrame: vi.fn(),
  useLoader: vi.fn(() => new THREE.Texture()),
  useThree: () => ({ camera: mocks.camera }),
}))

vi.mock('@react-three/drei', () => ({
  PositionalAudio: () => null,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('gsap', () => ({
  default: {
    delayedCall: vi.fn(),
    to: mocks.gsapTo,
  },
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({ unlockAchievement: vi.fn() }),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    isTeleporting: false,
    roomLoadState: { phase: mocks.roomPhase },
  }),
}))

vi.mock('@/hooks/useRoomTutorial', () => ({
  useRoomTutorial: vi.fn(),
}))

vi.mock('@/hooks/useWheelRouter', () => ({
  useWheelRouter: () => mocks.router,
}))

beforeEach(() => {
  mocks.roomPhase = 'loading'
  mocks.gsapTo.mockReset()
  mocks.tweenKill.mockReset()
  mocks.gsapTo.mockReturnValue({ kill: mocks.tweenKill })
  mocks.router.subscribe.mockClear()
  mocks.router.activate.mockClear()
  mocks.router.deactivate.mockClear()
})

describe('ProjectsRoom camera ownership', () => {
  it('waits for entered, starts once entered, and kills on unmount', () => {
    const { rerender, unmount } = render(
      <ProjectsRoom showRoom isExiting={false} />,
    )

    expect(mocks.gsapTo).not.toHaveBeenCalled()

    mocks.roomPhase = 'entered'
    rerender(<ProjectsRoom showRoom isExiting={false} />)

    expect(mocks.gsapTo).toHaveBeenCalledOnce()
    expect(mocks.gsapTo).toHaveBeenCalledWith(
      mocks.camera.position,
      expect.objectContaining({ x: 3, y: -3 }),
    )

    unmount()

    expect(mocks.tweenKill).toHaveBeenCalledOnce()
  })
})
