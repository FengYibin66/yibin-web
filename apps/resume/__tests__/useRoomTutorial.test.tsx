import { act, render } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const tutorialMocks = vi.hoisted(() => ({
  phase: 'aligning',
  showTutorial: vi.fn(),
  dismissTutorial: vi.fn(),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    roomLoadState: { phase: tutorialMocks.phase },
  }),
}))

vi.mock('@/context/AchievementsContext', () => {
  const mocked = {
  useAchievements: () => ({
    showTutorial: tutorialMocks.showTutorial,
    dismissTutorial: tutorialMocks.dismissTutorial,
  }),
  }
  // 动作类消费方走 useAchievementActions（只含稳定回调的那半个 context），mock 同一份即可
  return { ...mocked, useAchievementActions: mocked.useAchievements }
})

import { useRoomTutorial } from '@/hooks/useRoomTutorial'

/**
 * 房间教程的时机与**收尾**。
 *
 * 收尾那一半是这次补的（ADR 20260903211302）。此前教程气泡刻意不自动消失，而
 * 「什么时候关掉」由四个互不知情的房间组件各自负责——结果全仓只有
 * `PublicationsRoom` 做了。表现：进 About 不滚动 → 2 秒后弹出教程 → 退回走廊 →
 * **气泡一直挂着**；再进别的房间，它的教程排在队列第二位，**永远显示不出来**。
 *
 * 也就是说漏掉一处不是「多一个气泡」，而是教程系统整体失效，且没有任何症状指向
 * 队列。审计 A7 记过这条并标为已修，实际只修了一间房——所以这里要有断言。
 */

function TutorialHarness({ tutorialId, roomId }: { tutorialId: string, roomId: string }) {
  useRoomTutorial(tutorialId, roomId)
  return null
}

describe('useRoomTutorial', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    tutorialMocks.phase = 'aligning'
    tutorialMocks.showTutorial.mockReset()
    tutorialMocks.dismissTutorial.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('相位不是 entered 时不弹', () => {
    render(<TutorialHarness tutorialId="about_scroll" roomId="about" />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()
  })

  it('进房 2 秒后弹一次，并带上这间房的作用域', () => {
    tutorialMocks.phase = 'entered'
    const { rerender } = render(
      <TutorialHarness tutorialId="projects_inspect" roomId="projects" />,
    )

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()

    rerender(<TutorialHarness tutorialId="projects_inspect" roomId="projects" />)
    act(() => {
      vi.advanceTimersByTime(1)
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).toHaveBeenCalledTimes(1)
    /*
      作用域必须是 `room:<id>` 而不是别的什么。这条是整套机制的支点：
      `enterScope` 靠它判断"这个气泡属不属于当前场景"，写错了就等于没有作用域。
    */
    expect(tutorialMocks.showTutorial)
      .toHaveBeenCalledWith('projects_inspect', 'room:projects')
  })

  it('离开 entered 相位时取消还没弹出的教程', () => {
    tutorialMocks.phase = 'entered'
    const { rerender } = render(
      <TutorialHarness tutorialId="publications_read" roomId="publications" />,
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    tutorialMocks.phase = 'opening'
    rerender(<TutorialHarness tutorialId="publications_read" roomId="publications" />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()
  })

  it('已经弹出来的教程在离开房间时被出队 —— 不然它会留在走廊里堵住队列', () => {
    tutorialMocks.phase = 'entered'
    const { unmount } = render(
      <TutorialHarness tutorialId="about_scroll" roomId="about" />,
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(tutorialMocks.showTutorial).toHaveBeenCalledTimes(1)

    unmount()

    /*
      光清定时器不够：定时器已经触发过，气泡在队列里了。原实现只有
      `clearTimeout`，于是"进房超过 2 秒再退出"这条路径上气泡必然残留
      ——而那是最常见的路径。
    */
    expect(
      tutorialMocks.dismissTutorial,
      '卸载时没有把已弹出的气泡出队',
    ).toHaveBeenCalledWith('about_scroll')
  })

  it('相位离开 entered 时也出队（传送走的是这条路，组件不一定卸载）', () => {
    tutorialMocks.phase = 'entered'
    const { rerender } = render(
      <TutorialHarness tutorialId="contact_found" roomId="contact" />,
    )
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    tutorialMocks.phase = 'exiting'
    rerender(<TutorialHarness tutorialId="contact_found" roomId="contact" />)

    expect(tutorialMocks.dismissTutorial).toHaveBeenCalledWith('contact_found')
  })
})
