'use client'

import { useEffect, useState } from 'react'

import { COARSE_QUERY, HOVER_QUERY, NARROW_QUERY } from '@/lib/layout/breakpoints'

/**
 * 视口形态判据的单一读点（ADR 20260909182319）。读点数量由
 * `__tests__/viewportReaders.test.ts` 棘轮守着。
 *
 * 三个字段是**三个独立维度**，不许压成一个布尔：只看宽度会让拖窄的桌面窗口
 * 掉进手机静态图路径，只看指针会让 iPad 横屏掉进去，`!isTouch` 代替 `canHover`
 * 会判错 Surface / 接了鼠标的 iPad。
 */
export interface Viewport {
  /** 窄屏（< 768） */
  isNarrow: boolean
  /** 粗指针（手指） */
  isTouch: boolean
  /** 支持悬停。**不是** `!isTouch` */
  canHover: boolean
}

/** `null` = 还没判定（SSR / 首帧）。调用方必须处理这个态，否则手机上会闪一下桌面版 */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)

  useEffect(() => {
    // 没有 matchMedia（jsdom）就停在 null：调用方本来就要处理这个态，
    // 而抛异常会把「读不到视口」升级成整页白屏
    if (typeof window.matchMedia !== 'function') return

    const narrow = window.matchMedia(NARROW_QUERY)
    const coarse = window.matchMedia(COARSE_QUERY)
    const hover = window.matchMedia(HOVER_QUERY)

    const read = () => setViewport({
      isNarrow: narrow.matches,
      isTouch: coarse.matches,
      canHover: hover.matches,
    })

    read()

    /*
      订阅 MediaQueryList 的 change 而不是 window.resize：后者在移动 Safari 上
      滚动时也会触发（地址栏收起改变高度），而这三个查询只关心宽度与指针。

      两种形态都要认：`addEventListener` 要到 Safari 14 才有，更早只有
      `addListener`。都没有时（精简的测试替身）只读一次，不再跟随变化。
    */
    type LegacyMql = MediaQueryList & {
      addListener?: (cb: () => void) => void
      removeListener?: (cb: () => void) => void
    }
    const subscribe = (mql: MediaQueryList) => {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', read)
        return () => mql.removeEventListener('change', read)
      }
      const legacy = mql as LegacyMql
      if (typeof legacy.addListener === 'function') {
        legacy.addListener(read)
        return () => legacy.removeListener?.(read)
      }
      return () => {}
    }

    const unsubscribes = [narrow, coarse, hover].map(subscribe)
    return () => { for (const off of unsubscribes) off() }
  }, [])

  return viewport
}
