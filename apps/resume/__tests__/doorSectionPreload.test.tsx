import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as DoorSectionModule from '@/components/lab/DoorSection'
import { preloadRoomAssets } from '@/lib/lab/roomAssets'

const { DoorSection } = DoorSectionModule

interface DoorEscapeState {
  isInsideRoom: boolean
  isAnimating: boolean
  isTeleporting: boolean
}

type HandleDoorEscape = (
  event: KeyboardEvent,
  state: DoorEscapeState,
  requestExit: () => void,
) => void

const testState = vi.hoisted(() => ({
  frameCallbacks: [] as Array<() => void>,
  camera: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    parent: null,
  },
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => testState.frameCallbacks.push(callback),
  useThree: () => ({ camera: testState.camera }),
}))

vi.mock('@react-three/drei', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useTexture: () => ({
    clone: () => ({
      needsUpdate: false,
      wrapS: 0,
      wrapT: 0,
      repeat: { set: vi.fn() },
      offset: { set: vi.fn() },
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}))

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(),
    delayedCall: vi.fn(() => ({ kill: vi.fn() })),
  },
}))

vi.mock('@/context/AudioContext', () => ({
  useAudio: () => ({ play: vi.fn() }),
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({ unlockAchievement: vi.fn() }),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    enterRoom: vi.fn(),
    exitRoom: vi.fn(),
    exitRequested: false,
    pendingDoorClick: null,
    isFastTeleport: false,
    isTeleporting: false,
    teleportPhase: 'idle',
    currentRoom: null,
    signalRoomReady: vi.fn(),
    roomLoadState: {
      phase: 'idle',
      roomId: null,
      attempt: 0,
      error: null,
    },
    beginRoomLoad: vi.fn(),
    markRoomAligned: vi.fn(),
    markRoomReady: vi.fn(),
    markRoomOpening: vi.fn(),
    markRoomEntered: vi.fn(),
    timeoutRoomLoad: vi.fn(),
    failRoomLoad: vi.fn(),
    resetRoomLoad: vi.fn(),
    resetRoomLoadForTeleport: vi.fn(),
    requestExit: vi.fn(),
  }),
}))

vi.mock('@/components/lab/shaders/RevealMaterial', () => ({}))
vi.mock('@/components/lab/RoomInterior', () => ({ RoomInterior: () => null }))
vi.mock('@/lib/lab/roomAssets', () => ({ preloadRoomAssets: vi.fn() }))

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

function prepareThreeGroups(container: HTMLElement): void {
  container.querySelectorAll('group').forEach((group) => {
    Object.assign(group, {
      rotation: { y: 0 },
      scale: { x: 1 },
      visible: true,
    })
  })
}

function getHandleDoorEscape(): HandleDoorEscape {
  const handler: unknown = Reflect.get(DoorSectionModule, 'handleDoorEscape')
  expect(handler).toBeTypeOf('function')
  if (typeof handler !== 'function') {
    throw new Error('DoorSection must export handleDoorEscape')
  }
  return handler as HandleDoorEscape
}

describe('DoorSection Escape exit guard', () => {
  it('does not request exit while teleporting from inside a room', () => {
    const requestExit = vi.fn()

    getHandleDoorEscape()(
      new KeyboardEvent('keydown', { key: 'Escape' }),
      { isInsideRoom: true, isAnimating: false, isTeleporting: true },
      requestExit,
    )

    expect(requestExit).not.toHaveBeenCalled()
  })

  it('requests exit from Escape when entered and not teleporting', () => {
    const requestExit = vi.fn()

    getHandleDoorEscape()(
      new KeyboardEvent('keydown', { key: 'Escape' }),
      { isInsideRoom: true, isAnimating: false, isTeleporting: false },
      requestExit,
    )

    expect(requestExit).toHaveBeenCalledTimes(1)
  })
})

describe('DoorSection room asset preload', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    testState.frameCallbacks.length = 0
    testState.camera.position.z = 0
    vi.mocked(preloadRoomAssets).mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('普通房门距离小于 15 时触发资源预载', () => {
    const { container } = render(
      <DoorSection
        position={[0, 0, -20]}
        side="left"
        type="about"
        label="About"
        roomId="about"
        setCameraOverride={vi.fn()}
      />,
    )
    prepareThreeGroups(container)

    const frame = testState.frameCallbacks[0]
    frame()
    expect(preloadRoomAssets).not.toHaveBeenCalled()

    testState.camera.position.z = -5.1
    frame()
    frame()
    expect(preloadRoomAssets).toHaveBeenCalledWith('about')
    expect(preloadRoomAssets).toHaveBeenCalledTimes(1)
  })

  it('指针进入普通房门时再次请求预载', () => {
    const { container } = render(
      <DoorSection
        position={[0, 0, -20]}
        side="left"
        type="about"
        label="About"
        roomId="about"
        setCameraOverride={vi.fn()}
      />,
    )

    const doorGroup = container.querySelector('revealMaterial')?.closest('group')
    expect(doorGroup).not.toBeNull()
    fireEvent.pointerEnter(doorGroup as Element)
    expect(preloadRoomAssets).toHaveBeenCalledWith('about')
  })

  it('gallery 不接入普通房间资源清单', () => {
    const { container } = render(
      <DoorSection
        position={[0, 0, -20]}
        side="right"
        type="social"
        label="Gallery"
        roomId="gallery"
        setCameraOverride={vi.fn()}
      />,
    )
    prepareThreeGroups(container)

    testState.camera.position.z = -6
    testState.frameCallbacks[0]()
    expect(preloadRoomAssets).not.toHaveBeenCalled()
  })
})
