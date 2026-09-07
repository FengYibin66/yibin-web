'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { skewForScroll } from '@/lib/animations/scrollSkew'

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    /*
      滚动倾斜每帧从 Lenis 当前状态**派生**（`lib/animations/scrollSkew.ts`），不靶向事件。
      前身在 `scroll` 事件里 `gsap.to(skewY: velocity * 0.35)`：hash 跳转那一帧速度极大，
      项目卡被推到 skewY ≈ 88° 后再没有事件把它拉回（2026-09-07 实机）。
      派生式的值在 Lenis 停下时自然是 0，且只在用户平滑滚动时非零、夹在 ±8°。
      `lastSkew` 去重：绝大多数帧是 0 → 0，不碰 DOM。
    */
    let lastSkew = 0
    const tickerFn = (time: number) => {
      lenis.raf(time * 1000)
      const skew = skewForScroll(lenis.velocity, lenis.isScrolling)
      if (skew === lastSkew) return
      lastSkew = skew
      const targets = document.querySelectorAll('[data-skew]')
      if (targets.length) gsap.set(targets, { skewY: skew })
    }
    gsap.ticker.add(tickerFn)
    gsap.ticker.lagSmoothing(0)

    lenis.on('scroll', ScrollTrigger.update)

    /*
      cleanup 只撤自己的：ticker 回调、Lenis 监听、Lenis 实例。前身是
      `ScrollTrigger.getAll().forEach(t => t.kill())`——清全局，会把别的组件（Classic 页的
      滚动显形）的触发器与播放中的 tween 一起杀掉（ADR 20260907120701；门禁
      `noGlobalScrollTriggerKill`）。
    */
    return () => {
      const targets = document.querySelectorAll('[data-skew]')
      if (targets.length) gsap.set(targets, { skewY: 0 })
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [])

  return <>{children}</>
}
