import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  consumeEscape,
  escapeConsumerCount,
  pushEscapeConsumer,
  resetEscapeStack,
} from '@/lib/lab/app/escapeStack'
import { handleDoorEscape } from '@/components/lab/DoorSection'

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

describe('handleDoorEscape 与消费栈的优先级', () => {
  it('没人认领时 ESC 退出房间', () => {
    const exit = vi.fn()
    handleDoorEscape(escKey(), insideRoom, exit)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('有人认领时 ESC 交给它，**不退出房间** —— 这正是实机那个 bug', () => {
    const exit = vi.fn()
    const dismiss = vi.fn()
    pushEscapeConsumer(dismiss)

    handleDoorEscape(escKey(), insideRoom, exit)

    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(exit, '房间被退掉了，收回白点').not.toHaveBeenCalled()
  })

  it('认领取消后 ESC 又回到退出房间', () => {
    const exit = vi.fn()
    const release = pushEscapeConsumer(vi.fn())
    release()
    handleDoorEscape(escKey(), insideRoom, exit)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('不在房间里时既不认领也不退出', () => {
    const exit = vi.fn()
    const dismiss = vi.fn()
    pushEscapeConsumer(dismiss)
    handleDoorEscape(escKey(), { ...insideRoom, isInsideRoom: false }, exit)
    expect(exit).not.toHaveBeenCalled()
    expect(dismiss, '走廊里的 ESC 不该触发房间内的收回').not.toHaveBeenCalled()
  })

  it('动画中 / 传送中 ESC 一律忽略', () => {
    const exit = vi.fn()
    const dismiss = vi.fn()
    pushEscapeConsumer(dismiss)
    handleDoorEscape(escKey(), { ...insideRoom, isAnimating: true }, exit)
    handleDoorEscape(escKey(), { ...insideRoom, isTeleporting: true }, exit)
    expect(exit).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('非 ESC 键不触发任何一方', () => {
    const exit = vi.fn()
    const dismiss = vi.fn()
    pushEscapeConsumer(dismiss)
    handleDoorEscape(new KeyboardEvent('keydown', { key: 'a' }), insideRoom, exit)
    expect(exit).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })
})
