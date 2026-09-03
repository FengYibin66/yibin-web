import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  corridorRailJumpTo,
  isCorridorRailMounted,
  registerCorridorRail,
  resetCorridorRail,
} from '@/lib/lab/app/camera/corridorRail'

/**
 * 走廊导轨的注册表（ADR 20260903211244）。
 *
 * ## 它修的是什么
 *
 * 传送原先走 `cameraDirector.moveToWorld({ duration: 0 })`，而那条路径**在导演
 * 不持有相机时是空操作**：
 *
 *   `moveToWorld(duration ≤ 0)` → `push()` → `controls.setLookAt(…, false)`
 *
 * camera-controls 的 `setLookAt(enableTransition = false)` 只改它内部的
 * `_target` / `_spherical`，**相机位姿要等 `update()` 才应用**——而走廊里导演不
 * 持有相机，`update()` 第一行就 return。相机一动不动。
 *
 * ## 为什么这个 bug 能活下来
 *
 * 它的单测断言的是导演内部的 `snapshot()`——**导演想要的位姿**，不是
 * `camera.position`——**相机实际的位姿**。两者在这个 bug 下恰好不一致，而测试只
 * 看了前者。这条教训写进了 `apps/resume/AGENTS.md`：不要用 `snapshot()` 断言
 * 相机行为。
 *
 * 所以本文件的断言对象是**导轨真的收到了命令**，而 `hooks/useCorridorCamera.ts`
 * 里的实现直接写 `targetZ` 与 `currentZ` 两个 ref（两个一起设——只设目标会让相机
 * 平滑滑过去，而传送要的是瞬移）。
 */

afterEach(() => {
  resetCorridorRail()
})

describe('走廊导轨的注册表', () => {
  it('没挂载时命令送不到，且如实返回 false', () => {
    expect(isCorridorRailMounted()).toBe(false)
    expect(
      corridorRailJumpTo(-40),
      '没人接收却返回了 true —— 调用方会以为传送成功了',
    ).toBe(false)
  })

  it('挂载后命令送达，参数原样传给导轨', () => {
    const jumpTo = vi.fn()
    registerCorridorRail({ jumpTo })

    expect(corridorRailJumpTo(-40)).toBe(true)
    expect(jumpTo).toHaveBeenCalledExactlyOnceWith(-40)
  })

  it('注销之后命令又送不到', () => {
    const jumpTo = vi.fn()
    const unregister = registerCorridorRail({ jumpTo })
    unregister()

    expect(isCorridorRailMounted()).toBe(false)
    expect(corridorRailJumpTo(-40)).toBe(false)
    expect(jumpTo).not.toHaveBeenCalled()
  })

  it('注销是幂等的', () => {
    const unregister = registerCorridorRail({ jumpTo: vi.fn() })
    unregister()
    expect(() => unregister()).not.toThrow()
  })

  it('注销只清掉自己 —— 后来者不会被前一个的清理函数带走', () => {
    /*
      走廊组件重挂载时的顺序是「新的先挂、旧的后清」（React 的 effect 顺序），
      所以旧的清理函数不能无条件清空注册表，否则会把新登记的那个也清掉。
    */
    const first = { jumpTo: vi.fn() }
    const unregisterFirst = registerCorridorRail(first)
    unregisterFirst()

    const second = { jumpTo: vi.fn() }
    registerCorridorRail(second)
    unregisterFirst() // 旧的清理函数再跑一次

    expect(isCorridorRailMounted(), '被旧的清理函数误清了').toBe(true)
    expect(corridorRailJumpTo(-40)).toBe(true)
    expect(second.jumpTo).toHaveBeenCalledOnce()
  })

  it('重复登记会抛 —— 同一时刻两处驱动走廊相机是错误', () => {
    /*
      两个 `useCorridorCamera` 同时挂载意味着两个写者在抢走廊相机，表现是抖动。
      静默覆盖前一个会让这件事很难查，所以开发态直接抛。
    */
    registerCorridorRail({ jumpTo: vi.fn() })
    expect(() => registerCorridorRail({ jumpTo: vi.fn() })).toThrow(/两次/)
  })
})
