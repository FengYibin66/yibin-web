import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TourCoachMark } from '@/components/lab/TourCoachMark'
import { TOUR_HINT_MS } from '@/lib/lab/tourHintStorage'

/**
 * 路线入口的一次性引导（规格 `lab-corridor-story.md` §5.2）。
 *
 * 这里断言**淡出时机**（假定时器）；渲染几何与命中判定在 `e2e/lab.spec.ts`，
 * jsdom 两者都测不到。
 */

const KEY = 'lab_tour_hinted'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('路线入口的一次性引导', () => {
  it('首访出现，且带可读的文字（不是只有一个图标）', () => {
    render(<TourCoachMark label="第一次来？点这里，我带你走一遍" onStart={() => {}} />)
    const mark = screen.getByTestId('tour-coach-mark')
    expect(mark).toBeInTheDocument()
    expect(mark.textContent).toContain('带你走一遍')
  })

  it('显示过就立刻落盘，不等它淡完', () => {
    render(<TourCoachMark label="提示" onStart={() => {}} />)
    expect(localStorage.getItem(KEY)).toBe('1')
  })

  it('回访不出现', () => {
    localStorage.setItem(KEY, '1')
    render(<TourCoachMark label="提示" onStart={() => {}} />)
    expect(screen.queryByTestId('tour-coach-mark')).toBeNull()
  })

  it(`${TOUR_HINT_MS / 1000} 秒后自动淡出并从 DOM 移除`, () => {
    render(<TourCoachMark label="提示" onStart={() => {}} />)
    act(() => { vi.advanceTimersByTime(TOUR_HINT_MS) })
    expect(screen.getByTestId('tour-coach-mark')).toHaveAttribute('data-fading', 'true')
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByTestId('tour-coach-mark')).toBeNull()
  })

  it('点它就开始路线，并立刻收起', () => {
    const onStart = vi.fn()
    render(<TourCoachMark label="提示" onStart={onStart} />)
    fireEvent.click(screen.getByTestId('tour-coach-mark'))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('tour-coach-mark')).toBeNull()
  })

  it.each([
    ['pointerdown', () => fireEvent.pointerDown(window)],
    ['wheel', () => fireEvent.wheel(window)],
    // keydown 也要：只听指针会让键盘用户关不掉它
    ['keydown', () => fireEvent.keyDown(window, { key: 'a' })],
  ])('任何交互都收起：%s', (_name, fire) => {
    render(<TourCoachMark label="提示" onStart={() => {}} />)
    act(() => { fire() })
    expect(screen.getByTestId('tour-coach-mark')).toHaveAttribute('data-fading', 'true')
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByTestId('tour-coach-mark')).toBeNull()
  })

  it('lab_tour_hint_hold 置上后不淡出、也不被交互收起（E2E 用的钩子）', () => {
    // 钩子写错的话 E2E 会红，但没人会想到是钩子坏了，所以它自己要有覆盖
    localStorage.setItem('lab_tour_hint_hold', '1')
    render(<TourCoachMark label="提示" onStart={() => {}} />)

    act(() => { vi.advanceTimersByTime(TOUR_HINT_MS + 2_000) })
    expect(screen.getByTestId('tour-coach-mark')).toHaveAttribute('data-fading', 'false')

    act(() => { fireEvent.wheel(window) })
    expect(screen.getByTestId('tour-coach-mark')).toHaveAttribute('data-fading', 'false')
  })

  it('localStorage 抛异常时不炸（隐身模式 / 阻止站点数据）', () => {
    /*
      让**访问器**抛，而不是 spy 某个方法。

      两种实现都要覆盖：`vitest.setup.ts` 只在全局不可用时才装内存实现，
      所以 Node 25 本地拿到的是普通对象、CI 的 Node 20 拿到的是 jsdom 的
      `Storage`（Proxy 实现，`vi.spyOn` 在它上面定义属性会被静默吞掉——
      本地绿、CI 红就是这么来的）。
      替换访问器与被测代码用哪个对象身份无关。
    */
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('SecurityError') },
    })
    try {
      expect(() => render(<TourCoachMark label="提示" onStart={() => {}} />)).not.toThrow()
      expect(screen.queryByTestId('tour-coach-mark')).toBeNull()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else delete (globalThis as Record<string, unknown>).localStorage
    }
  })
})
