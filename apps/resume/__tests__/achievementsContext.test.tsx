import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stored: [] as string[],
  play: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/lib/lab/achievementStorage', () => ({
  loadAchievements: () => mocks.stored,
  saveAchievements: mocks.save,
  NEVER_PERSISTED: {},
}))

vi.mock('@/lib/lab/app/audio/AudioMixer', () => ({
  audioMixer: { play: mocks.play },
}))

import { AchievementsProvider, useAchievements } from '@/context/AchievementsContext'

/**
 * `AchievementsProvider` 的 React 侧接线。
 *
 * ## 为什么这个文件必须存在
 *
 * 这一层**此前零测试**：队列的策略（插队、幂等、淡出、作用域）有 33 个用例守着，
 * 而"把策略接到 React 上"这一段一个都没有——其余测试全部 `vi.mock` 掉
 * `useAchievements`。结果就是 reducer 完全正确，而接线里藏着一个用户每次进 Lab
 * 都能听到的 bug：
 *
 * **回访用户每次进 Lab 都响一声解锁音。** 解锁音的判定是「`completed` 变长了」，
 * 基线用一个 ref 记。原实现在**首帧**建立基线（那时 `completed` 是空的），
 * 而 `HYDRATE` 是 effect 里异步派发的——于是序列是 `0 → N`，被判成"刚解锁了 N 条"。
 * 代码注释写着「首次（含从存储恢复）不响」，与实际行为相反：注释描述的是意图，
 * 代码实现的是另一件事，而没有测试能发现这个差。
 *
 * 这是「reducer 测全了、接线没人测」的教科书案例，所以这一组刻意都是**行为**
 * 断言（响没响、响几次），不碰内部实现。
 */

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useAchievements>) => void }) {
  const api = useAchievements()
  onReady(api)
  return null
}

function renderProvider() {
  let api!: ReturnType<typeof useAchievements>
  const view = render(
    <AchievementsProvider>
      <Harness onReady={next => { api = next }} />
    </AchievementsProvider>,
  )
  return { view, get api() { return api } }
}

describe('解锁音的基线', () => {
  beforeEach(() => {
    mocks.stored = []
    mocks.play.mockReset()
    mocks.save.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('回访用户（存储里已有成就）挂载后**不响** —— 这就是那个 bug', () => {
    mocks.stored = ['about_scroll', 'contact_found']

    renderProvider()

    expect(
      mocks.play,
      '回访用户每次进 Lab 都听到一声解锁音（基线建在了 HYDRATE 之前）',
    ).not.toHaveBeenCalled()
  })

  it('首访用户挂载后也不响', () => {
    renderProvider()
    expect(mocks.play).not.toHaveBeenCalled()
  })

  it('回访用户之后真的解锁一条新的 → 响一次', () => {
    mocks.stored = ['about_scroll']
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('contact_found')
    })

    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(mocks.play).toHaveBeenCalledWith('achievement_chime', { volume: 0.7 })
  })

  it('重复解锁同一条只响一次 —— reducer 去重，音效不能绕过去重', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('contact_found')
    })
    act(() => {
      harness.api.unlockAchievement('contact_found')
    })

    expect(mocks.play).toHaveBeenCalledTimes(1)
  })

  it('解锁两条不同的响两次', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('contact_found')
    })
    act(() => {
      harness.api.unlockAchievement('about_scroll')
    })

    expect(mocks.play).toHaveBeenCalledTimes(2)
  })

  it('弹教程不响 —— 它不是解锁', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.showTutorial('about_scroll', 'room:about')
    })

    expect(mocks.play).not.toHaveBeenCalled()
  })
})

describe('气泡的生命周期（React 侧）', () => {
  beforeEach(() => {
    mocks.stored = []
    mocks.play.mockReset()
    mocks.save.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('弹出的教程会出现在 activePopup 上', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.showTutorial('about_scroll', 'room:about')
    })

    expect(harness.api.activePopup?.id).toBe('about_scroll')
    expect(harness.api.activePopup?.kind).toBe('tutorial')
  })

  it('庆祝气泡到时自动消失', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('contact_found')
    })
    expect(harness.api.activePopup?.kind).toBe('completed')

    // 2000ms 显示 + 500ms 淡出，定时器每 100ms 推一次
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(harness.api.activePopup).toBeNull()
  })

  it('教程气泡不会自己消失 —— 它在等用户照着做', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.showTutorial('about_scroll', 'room:about')
    })
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(harness.api.activePopup?.id).toBe('about_scroll')
  })

  it('enterScope 清掉不属于当前场景的教程', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.showTutorial('corridor_explore', 'corridor')
    })
    expect(harness.api.activePopup?.id).toBe('corridor_explore')

    act(() => {
      harness.api.enterScope('room:about')
    })

    expect(
      harness.api.activePopup,
      '走廊提示留在了房间里 —— 它会占住队首让房间教程显示不出来',
    ).toBeNull()
  })

  it('dismissTutorial 按 id 关掉指定那条', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.showTutorial('about_scroll', 'room:about')
    })
    act(() => {
      harness.api.dismissTutorial('about_scroll')
      vi.advanceTimersByTime(600)
    })

    expect(harness.api.activePopup).toBeNull()
  })

  it('空队列时不开定时器 —— 每 100ms 跑一次 reducer 是白烧电', () => {
    /*
      间接验证：挂载后不推进任何东西，`activePopup` 保持 null 且不抛。
      真正防的是"空队列还在 tick"，那在 DevTools 的更新记录里全是噪声。
    */
    const harness = renderProvider()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(harness.api.activePopup).toBeNull()
  })
})

describe('持久化', () => {
  beforeEach(() => {
    mocks.stored = []
    mocks.play.mockReset()
    mocks.save.mockReset()
  })

  it('解锁后写回存储', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('contact_found')
    })

    expect(mocks.save).toHaveBeenCalled()
    const lastCall = mocks.save.mock.calls.at(-1)?.[0] as string[]
    expect(lastCall).toContain('contact_found')
  })

  it('存储里的成就在 completed 里可见', () => {
    mocks.stored = ['about_scroll']
    const harness = renderProvider()
    expect(harness.api.completed).toContain('about_scroll')
    expect(harness.api.isUnlocked('about_scroll')).toBe(true)
  })

  it('不认识的 id 被忽略，不会污染状态', () => {
    const harness = renderProvider()

    act(() => {
      harness.api.unlockAchievement('not_a_real_achievement')
      harness.api.showTutorial('also_not_real', 'corridor')
    })

    expect(harness.api.completed).not.toContain('not_a_real_achievement')
    expect(harness.api.activePopup).toBeNull()
  })
})
