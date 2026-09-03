import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadRoomAssets } from '@/lib/lab/app/assets/preload'

import { DoorSection } from '@/components/lab/DoorSection'

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
    claim: vi.fn(),
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
      segmentIndex: null,
      attempt: 0,
      error: null,
    },
    dispatchDoorEntry: vi.fn(() => ({
      state: { phase: 'aligning', roomId: 'publications', segmentIndex: 0, attempt: 1, error: null },
      commands: ['ALIGN_CAMERA'],
    })),
    markRoomOpening: vi.fn(),
    timeoutRoomLoad: vi.fn(),
    failRoomLoad: vi.fn(),
    resetRoomLoad: vi.fn(),
    resetRoomLoadForTeleport: vi.fn(),
    requestExit: vi.fn(),
  }),
}))

vi.mock('@/components/lab/shaders/RevealMaterial', () => ({}))
vi.mock('@/components/lab/RoomInterior', () => ({ RoomInterior: () => null }))
vi.mock('@/lib/lab/app/assets/preload', () => ({ preloadRoomAssets: vi.fn() }))

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

/*
  ── ESC 的守卫测试搬走了 ────────────────────────────────────────────────────

  这里原先测 `DoorSection` 导出的 `handleDoorEscape(event, state, requestExit)`，
  两条断言是「传送中不退房」与「已进房且不在传送时退房」。

  那个函数与它**每个门实例各挂一个**的 window 监听（15 段走廊 = 15 个监听）已被
  `components/lab/useEscapeRouter.ts` 取代（ADR 20260903211244），退房的守卫也
  合并回 `requestExit()` 自己那一处——它守着
  `phase === 'entered' && !isTeleporting`，正是上面那两条断言的内容，只是不再
  有第二套并行判断。

  接替的覆盖：
  - `__tests__/escapeStack.test.ts` 测路由规则（栈顶优先、没人认领才兜底）
  - `e2e/lab.spec.ts` 端到端测「房间里 ESC 退房」「走廊 ESC 关面板」——那才是
    当初出问题的层面（多个真实 window 监听互相不知情），单测层面看不出来
*/

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
