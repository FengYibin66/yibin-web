import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  corridorRailHold,
  corridorRailJumpTo,
  corridorRailRelease,
  corridorRailScrollTo,
  isCorridorRailMounted,
  registerCorridorRail,
  resetCorridorRail,
  type CorridorRailHandle,
} from '@/lib/lab/app/camera/corridorRail'

/** 一个全是 mock 的导轨句柄（ADR 20260908204302 后命令面有四条） */
function fakeHandle(): CorridorRailHandle {
  return {
    jumpTo: vi.fn(),
    scrollTo: vi.fn(() => Promise.resolve()),
    hold: vi.fn(),
    release: vi.fn(),
  }
}

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
    registerCorridorRail({ ...fakeHandle(), jumpTo })

    expect(corridorRailJumpTo(-40)).toBe(true)
    expect(jumpTo).toHaveBeenCalledExactlyOnceWith(-40)
  })

  it('注销之后命令又送不到', () => {
    const jumpTo = vi.fn()
    const unregister = registerCorridorRail({ ...fakeHandle(), jumpTo })
    unregister()

    expect(isCorridorRailMounted()).toBe(false)
    expect(corridorRailJumpTo(-40)).toBe(false)
    expect(jumpTo).not.toHaveBeenCalled()
  })

  it('注销是幂等的', () => {
    const unregister = registerCorridorRail(fakeHandle())
    unregister()
    expect(() => unregister()).not.toThrow()
  })

  it('注销只清掉自己 —— 后来者不会被前一个的清理函数带走', () => {
    /*
      走廊组件重挂载时的顺序是「新的先挂、旧的后清」（React 的 effect 顺序），
      所以旧的清理函数不能无条件清空注册表，否则会把新登记的那个也清掉。
    */
    const first = fakeHandle()
    const unregisterFirst = registerCorridorRail(first)
    unregisterFirst()

    const second = fakeHandle()
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
    registerCorridorRail(fakeHandle())
    expect(() => registerCorridorRail(fakeHandle())).toThrow(/两次/)
  })
})

describe('导轨命令面：scrollTo / hold / release（ADR 20260908204302）', () => {
  it('没挂载：scrollTo reject、hold / release 返回 false', async () => {
    await expect(corridorRailScrollTo(0, { duration: 1 })).rejects.toThrow(/没挂载/)
    expect(corridorRailHold('tour', () => {})).toBe(false)
    expect(corridorRailRelease('tour')).toBe(false)
  })

  it('挂载后原样转交参数', async () => {
    const handle = fakeHandle()
    registerCorridorRail(handle)
    await corridorRailScrollTo(-30, { duration: 2, ease: 'power1.inOut' })
    expect(handle.scrollTo).toHaveBeenCalledWith(-30, { duration: 2, ease: 'power1.inOut' })
    const onInput = () => {}
    expect(corridorRailHold('tour', onInput)).toBe(true)
    expect(handle.hold).toHaveBeenCalledWith('tour', onInput)
    expect(corridorRailRelease('tour')).toBe(true)
    expect(handle.release).toHaveBeenCalledWith('tour')
  })
})
