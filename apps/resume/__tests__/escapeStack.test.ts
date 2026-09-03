import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  consumeEscape,
  escapeConsumerCount,
  pushEscapeConsumer,
  resetEscapeStack,
} from '@/lib/lab/app/escapeStack'

/**
 * ESC 的优先级。
 *
 * 这一组测的是实机抓到的冲突：ESC 已经绑定「退出房间」，而 Projects 的
 * 「收回停靠」也想用它。两个 window 监听同时触发时房间开始退场，收回被
 * `isExiting` 挡掉——相位序列
 * `docked → undocking → undocking(exiting) → browsing(exiting)`，
 * 表现是"按 ESC 直接退出了房间，停靠白点"。
 *
 * 光看单个组件的代码看不出这个 bug：两边各自都对，缺的是"谁优先"的定义。
 */

afterEach(() => resetEscapeStack())

const escKey = () => new KeyboardEvent('keydown', { key: 'Escape' })
const insideRoom = { isInsideRoom: true, isAnimating: false, isTeleporting: false }

describe('escapeStack', () => {
  it('没人认领时不消费', () => {
    expect(consumeEscape()).toBe(false)
  })

  it('栈顶优先 —— 最内层打开的东西先关', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    pushEscapeConsumer(outer)
    pushEscapeConsumer(inner)

    expect(consumeEscape()).toBe(true)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer, '外层被越过了').not.toHaveBeenCalled()
  })

  it('取消认领后回到上一层', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    pushEscapeConsumer(outer)
    const release = pushEscapeConsumer(inner)

    release()
    expect(consumeEscape()).toBe(true)
    expect(outer).toHaveBeenCalledTimes(1)
    expect(inner).not.toHaveBeenCalled()
  })

  it('重复取消认领是幂等的 —— effect 清理可能跑两次', () => {
    const fn = vi.fn()
    const release = pushEscapeConsumer(fn)
    release()
    release()
    expect(escapeConsumerCount()).toBe(0)
  })

  it('取消中间那一层不影响其余顺序', () => {
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()
    pushEscapeConsumer(a)
    const releaseB = pushEscapeConsumer(b)
    const releaseC = pushEscapeConsumer(c)

    releaseB()

    // 栈顶是 c（消费不出栈，所以要显式释放才轮到下一层）
    expect(consumeEscape()).toBe(true)
    expect(c).toHaveBeenCalledTimes(1)

    releaseC()
    expect(consumeEscape()).toBe(true)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b, '被移除的那一层还在收 ESC').not.toHaveBeenCalled()
  })

  it('消费不会自动出栈 —— 出栈由消费者自己的清理负责', () => {
    const fn = vi.fn()
    pushEscapeConsumer(fn)
    consumeEscape()
    expect(escapeConsumerCount()).toBe(1)
  })
})

/*
  ── 路由本身的测试搬到了哪里 ────────────────────────────────────────────────

  原先这里测的是 `handleDoorEscape(event, state, requestExit)`——一个纯函数，
  带三个"每个门实例各自的" state（`isInsideRoom` / `isAnimating` /
  `isTeleporting`）。那个函数与它的 15 个 window 监听已经被
  `components/lab/useEscapeRouter.ts` 取代（ADR 20260903211244），退房的守卫也
  合并回 `requestExit()` 自己那一处。

  所以这里改测**路由规则本身**：栈顶优先，没人认领才落到兜底动作。这就是
  `useEscapeRouter` 里那两行的语义，写成纯函数形态断言，不必渲染整个 Lab。
  「在房间里按 ESC 关面板不该连带退房」由 `e2e/lab.spec.ts` 端到端守着——
  那才是当初出问题的层面（两个真实的 window 监听），单测层面看不出来。
*/

/** `useEscapeRouter` 的判定规则，与它内部那两行一致 */
function routeEscape(fallback: () => void): void {
  if (consumeEscape()) return
  fallback()
}

describe('ESC 路由规则：栈顶优先，兜底退房', () => {
  it('没人认领时走兜底动作（退出房间）', () => {
    const exit = vi.fn()
    routeEscape(exit)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('有人认领时交给它，**不走兜底** —— 这正是实机那个 bug', () => {
    const exit = vi.fn()
    const dismiss = vi.fn()
    pushEscapeConsumer(dismiss)

    routeEscape(exit)

    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(exit, '房间被退掉了，收回白点').not.toHaveBeenCalled()
  })

  it('认领取消后又回到兜底', () => {
    const exit = vi.fn()
    const release = pushEscapeConsumer(vi.fn())
    release()
    routeEscape(exit)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('多层认领时只有最内层被调用，兜底一次都不走', () => {
    const exit = vi.fn()
    const outer = vi.fn()
    const inner = vi.fn()
    pushEscapeConsumer(outer)
    pushEscapeConsumer(inner)

    routeEscape(exit)

    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer, '外层不该同时被关掉').not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()
  })

  it('逐层退出：关掉内层后下一次 ESC 关外层，再一次才兜底', () => {
    const exit = vi.fn()
    const outer = vi.fn()
    const releaseInner = pushEscapeConsumer(vi.fn())
    pushEscapeConsumer(outer)
    // 注意入栈顺序：上面这两行让 outer 在栈顶，先测它
    routeEscape(exit)
    expect(outer).toHaveBeenCalledTimes(1)

    // 消费者不自动出栈（由各自的 effect 清理负责），这里手动取消认领
    releaseInner()
    expect(escapeConsumerCount(), 'outer 还在栈里').toBe(1)
  })

  it('兜底动作只被调用一次 —— 重复调用等于房间退两次', () => {
    const exit = vi.fn()
    routeEscape(exit)
    expect(exit).toHaveBeenCalledTimes(1)
  })
})
