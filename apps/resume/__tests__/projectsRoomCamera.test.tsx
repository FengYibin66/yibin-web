import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { projectsRoom } from '@/lib/lab/domain/rooms/projects'

/**
 * Projects 房间的相机接线。
 *
 * 这个文件原先测的是「进房后房间自己 `gsap.to(camera.position, {x:3, y:-3})`，
 * 卸载时 kill」——那个行为**按设计已经删掉**：它是审计 A4 的直接根因（写的是
 * 世界坐标，而房间挂在旋转约 −60° 的门 inner group 下），也是相机所有权四处
 * 违例之一。
 *
 * 现在要验的是相反的事：房间**不自己动相机**，只把声明里的 `entryPose` 与
 * 房间根 group 交给 `cameraDirector`，换算与插值由所有者做
 * （ADR 20260903140617）。坐标换算本身在 `cameraDirector.test.ts` 里验。
 */

const mocks = vi.hoisted(() => ({
  enterRoom: vi.fn(),
  suspend: vi.fn(),
  play: vi.fn(),
  unlockAchievement: vi.fn(),
  showTutorial: vi.fn(),
}))

vi.mock('@/lib/lab/app/camera/CameraDirector', () => ({
  cameraDirector: {
    enterRoom: mocks.enterRoom,
    suspend: mocks.suspend,
    frameObject: vi.fn(),
    returnToRoomPose: vi.fn(),
    moveToWorld: vi.fn(),
    setLean: vi.fn(),
  },
}))

vi.mock('@/lib/lab/app/audio/AudioMixer', () => ({
  audioMixer: { play: mocks.play, ambience_: vi.fn(), syncListener: vi.fn() },
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({
    unlockAchievement: mocks.unlockAchievement,
    showTutorial: mocks.showTutorial,
    isUnlocked: () => false,
    completed: [],
    activePopup: null,
    hidePopup: vi.fn(),
  }),
}))

vi.mock('@/hooks/useRoomTutorial', () => ({ useRoomTutorial: vi.fn() }))

/*
  R3F 与 drei 在 jsdom 里没有 WebGL 上下文。这里把 3D 图元退化成普通标签，
  只保留 React 的挂载/卸载与 effect 时序——本文件要验的正是时序。
*/
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ camera: {}, gl: { domElement: document.createElement('div') }, scene: {} }),
  extend: vi.fn(),
}))

/*
  纹理替身要有 `repeat` / `wrapS` / `clone()` —— `LabShell` 会按世界尺寸设置
  平铺次数。第一版 mock 只给了 `clone: () => ({})`，于是 `t.repeat.set()` 炸在
  一个空对象上：替身太薄，测的就不是被测代码了。
*/
function fakeTexture(): Record<string, unknown> {
  return {
    wrapS: 0,
    wrapT: 0,
    repeat: { set: vi.fn() },
    needsUpdate: false,
    clone: () => fakeTexture(),
  }
}

vi.mock('@react-three/drei', () => ({
  useTexture: (paths: string[]) => paths.map(() => fakeTexture()),
  Text: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/lab/infra/sketch/textureCache', () => ({
  sketchTexture: () => ({}),
}))

const { ProjectsRoom } = await import('@/components/rooms/projects/ProjectsRoom')

describe('ProjectsRoom 的相机接线', () => {
  beforeEach(() => {
    mocks.enterRoom.mockClear()
    mocks.suspend.mockClear()
  })

  it('进房时把声明里的 entryPose 交给相机所有者', () => {
    render(<ProjectsRoom showRoom isExiting={false} />, { wrapper: LocaleProvider })

    expect(mocks.enterRoom).toHaveBeenCalled()
    const [pose, root, freedom] = mocks.enterRoom.mock.calls[0]!
    expect(pose, '传的不是房间声明里的那个 pose').toBe(projectsRoom.entryPose)
    expect(freedom).toBe(projectsRoom.cameraFreedom)
    expect(root, '必须把房间根 group 一起传过去，否则换算退化成世界坐标（A4）')
      .not.toBeNull()
  })

  it('退房时把相机交还 —— 不交还的话 controls 每帧会抹掉 DoorSection 的退场 tween', () => {
    const { unmount } = render(
      <ProjectsRoom showRoom isExiting={false} />,
      { wrapper: LocaleProvider },
    )
    expect(mocks.suspend).not.toHaveBeenCalled()
    unmount()
    expect(mocks.suspend).toHaveBeenCalled()
  })

  it('isExiting 时不再取景 —— 退场动画归 DoorSection', () => {
    render(<ProjectsRoom showRoom isExiting />, { wrapper: LocaleProvider })
    expect(mocks.enterRoom).not.toHaveBeenCalled()
  })

  it('房间不可见时不动相机', () => {
    render(<ProjectsRoom showRoom={false} isExiting={false} />, { wrapper: LocaleProvider })
    expect(mocks.enterRoom).not.toHaveBeenCalled()
  })
})
