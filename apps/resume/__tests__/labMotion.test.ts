import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  currentMotionScale,
  prefersReducedMotion,
  subscribeMotionScale,
} from '@/lib/lab/app/motion'

/**
 * Lab 的动效开关（ADR 20260908172231）。
 *
 * Lab 此前完全不响应 `prefers-reduced-motion`（全仓 5 处命中全在 Classic 与
 * 加载指示器）。这批测试锁住三件事：读得对、变化能订阅到、**环境不支持时
 * 退化为正常动效而不是崩**（旧 WebView 的 `matchMedia` 会对未知媒体特性抛错）。
 */

type Listener = (event: MediaQueryListEvent) => void

/** 造一个可控的 MediaQueryList。`modern` 决定它有 addEventListener 还是只有 addListener */
function stubMatchMedia(matches: boolean, { modern = true }: { modern?: boolean } = {}) {
  const listeners = new Set<Listener>()
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    ...(modern
      ? {
          addEventListener: (_: string, listener: Listener) => listeners.add(listener),
          removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
        }
      : {
          addListener: (listener: Listener) => listeners.add(listener),
          removeListener: (listener: Listener) => listeners.delete(listener),
        }),
  } as unknown as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return {
    listeners,
    emit(next: boolean) {
      ;(mql as { matches: boolean }).matches = next
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Lab 动效开关', () => {
  describe('读取', () => {
    it('系统要求减少动效 → true / 0', () => {
      stubMatchMedia(true)
      expect(prefersReducedMotion()).toBe(true)
      expect(currentMotionScale()).toBe(0)
    })

    it('系统未要求 → false / 1', () => {
      stubMatchMedia(false)
      expect(prefersReducedMotion()).toBe(false)
      expect(currentMotionScale()).toBe(1)
    })

    it('matchMedia 抛错时退化为正常动效（旧 WebView），不冒泡', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => {
          throw new Error('not supported')
        }),
      )
      expect(() => prefersReducedMotion()).not.toThrow()
      expect(currentMotionScale()).toBe(1)
    })

    it('没有 matchMedia 时退化为正常动效', () => {
      vi.stubGlobal('matchMedia', undefined)
      expect(currentMotionScale()).toBe(1)
    })
  })

  describe('订阅', () => {
    it('立即回调一次当前值（消费者不必自己先读一次）', () => {
      stubMatchMedia(true)
      const onChange = vi.fn()
      const unsubscribe = subscribeMotionScale(onChange)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(0)
      unsubscribe()
    })

    it('系统设置变化时回调新值', () => {
      const stub = stubMatchMedia(false)
      const onChange = vi.fn()
      const unsubscribe = subscribeMotionScale(onChange)
      stub.emit(true)
      expect(onChange).toHaveBeenLastCalledWith(0)
      stub.emit(false)
      expect(onChange).toHaveBeenLastCalledWith(1)
      unsubscribe()
    })

    it('注销后不再回调，且监听器被摘掉（不泄漏）', () => {
      const stub = stubMatchMedia(false)
      const onChange = vi.fn()
      const unsubscribe = subscribeMotionScale(onChange)
      unsubscribe()
      expect(stub.listeners.size).toBe(0)
      stub.emit(true)
      expect(onChange).toHaveBeenCalledTimes(1) // 只有订阅时那一次
    })

    it('只有废弃的 addListener 的环境（Safari 14 之前）也能订阅与注销', () => {
      const stub = stubMatchMedia(false, { modern: false })
      const onChange = vi.fn()
      const unsubscribe = subscribeMotionScale(onChange)
      stub.emit(true)
      expect(onChange).toHaveBeenLastCalledWith(0)
      unsubscribe()
      expect(stub.listeners.size).toBe(0)
    })

    /**
     * 回归测试：**jsdom 的 `matchMedia` 桩两个订阅 API 都没有**。
     *
     * 第一版实现假设「没有 `addEventListener` 就一定有 `addListener`」，于是
     * 三个既有的 `LabScene` 组件测试直接抛
     * `mql.addListener is not a function`。同类桩在嵌入式 WebView 里也存在。
     */
    it('两个订阅 API 都没有时不抛，当前值仍回调一次', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true, media: '' }) as unknown as MediaQueryList),
      )
      const onChange = vi.fn()
      let unsubscribe: () => void = () => {}
      expect(() => {
        unsubscribe = subscribeMotionScale(onChange)
      }).not.toThrow()
      expect(onChange).toHaveBeenCalledWith(0)
      expect(() => unsubscribe()).not.toThrow()
    })

    it('环境不支持 matchMedia 时，订阅仍返回可安全调用的注销函数', () => {
      vi.stubGlobal('matchMedia', undefined)
      const onChange = vi.fn()
      const unsubscribe = subscribeMotionScale(onChange)
      expect(onChange).toHaveBeenCalledWith(1)
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})
