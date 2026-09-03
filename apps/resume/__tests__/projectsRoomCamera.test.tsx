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
  claim: vi.fn(),
  release: vi.fn(),
  play: vi.fn(),
  unlockAchievement: vi.fn(),
  showTutorial: vi.fn(),
  /** 房间加载相位。`useRoomCamera` 要等它变成 `entered` 才接管相机 */
  phase: 'entered' as string,
}))

vi.mock('@/lib/lab/app/camera/CameraDirector', () => ({
  cameraDirector: {
    claim: mocks.claim,
    release: mocks.release,
    frameObject: vi.fn(),
    returnToRoomPose: vi.fn(),
    moveToWorld: vi.fn(),
    setLean: vi.fn(),
  },
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({ roomLoadState: { phase: mocks.phase } }),
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
    mocks.claim.mockClear()
    mocks.release.mockClear()
    mocks.phase = 'entered'
  })

  it('接管时把声明里的 entryPose 与房间根一起交给所有者', () => {
    render(<ProjectsRoom showRoom isExiting={false} />, { wrapper: LocaleProvider })

    expect(mocks.claim).toHaveBeenCalled()
    const [pose, root, freedom] = mocks.claim.mock.calls[0]!
    expect(pose, '传的不是房间声明里的那个 pose').toBe(projectsRoom.entryPose)
    expect(freedom).toBe(projectsRoom.cameraFreedom)
    expect(root, '必须把房间根 group 一起传过去，否则换算退化成世界坐标（A4）')
      .not.toBeNull()
  })

  /*
    ── 这一组锁的是「什么时候接管」，而那正是进房双写的根因 ──────────────────

    房间在 `CAMERA_ALIGNED` 就挂载（`doorEntryFlow` 的 `MOUNT_ROOM`），而
    `DoorSection` 的进房飞行 tween 要到 `OPEN_DOOR` 之后才开始。第一版在**挂载时**
    就接管，于是两个写者重叠约 2 秒：导演每帧 `controls.update()` 写相机，
    `gsap.to(camera.position, …)` 也在写。

    谁赢取决于 gsap 的 rAF 与 R3F 渲染循环谁后注册——今天恰好是导演后写、每帧
    覆盖，所以**进房飞行动画被静默吞掉而画面看起来正常**。写点棘轮看不出这个问题
    （两边都登记过），只有"什么时候写"这条断言能守住。
  */
  it.each(['idle', 'aligning', 'loading', 'ready', 'opening'])(
    'phase=%s 时**不**接管 —— 那期间 DoorSection 还在写相机',
    phase => {
      mocks.phase = phase
      render(<ProjectsRoom showRoom isExiting={false} />, { wrapper: LocaleProvider })
      expect(
        mocks.claim,
        `phase=${phase} 时就接管了，会与 DoorSection 的进房 tween 同帧双写`,
      ).not.toHaveBeenCalled()
    },
  )

  it('phase=entered 时才接管', () => {
    mocks.phase = 'entered'
    render(<ProjectsRoom showRoom isExiting={false} />, { wrapper: LocaleProvider })
    expect(mocks.claim).toHaveBeenCalledOnce()
  })

  it('退房时把相机交还 —— 不交还的话 controls 每帧会抹掉 DoorSection 的退场 tween', () => {
    const { unmount } = render(
      <ProjectsRoom showRoom isExiting={false} />,
      { wrapper: LocaleProvider },
    )
    expect(mocks.release).not.toHaveBeenCalled()
    unmount()
    expect(mocks.release).toHaveBeenCalled()
  })

  it('isExiting 时不接管 —— 退场动画归 DoorSection', () => {
    render(<ProjectsRoom showRoom isExiting />, { wrapper: LocaleProvider })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('房间不可见时不动相机', () => {
    render(<ProjectsRoom showRoom={false} isExiting={false} />, { wrapper: LocaleProvider })
    expect(mocks.claim).not.toHaveBeenCalled()
  })
})
