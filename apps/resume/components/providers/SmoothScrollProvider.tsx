'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    const tickerFn = (time: number) => { lenis.raf(time * 1000) }
    gsap.ticker.add(tickerFn)
    gsap.ticker.lagSmoothing(0)

    lenis.on('scroll', ScrollTrigger.update)

    /*
      滚动倾斜的 tween 归本组件所有，收在 context 里，cleanup 只 revert 自己的。
      前身 cleanup 是 `ScrollTrigger.getAll().forEach(t => t.kill())`——清全局，会把
      别的组件（Classic 页的滚动显形）的触发器与播放中的 tween 一起杀掉
      （ADR 20260907120701；门禁 `noGlobalScrollTriggerKill`）。

      `[data-skew]` 只在 Classic 页存在。别的页面（Lab / Gallery）每次滚动对空目标
      发 tween，dev 下每次都是一条 "GSAP target not found" 警告；没有目标就不发。
    */
    const ctx = gsap.context(() => {
      lenis.on('scroll', ({ velocity }: { velocity: number }) => {
        if (!document.querySelector('[data-skew]')) return
        gsap.to('[data-skew]', {
          skewY: velocity * 0.35,
          ease: 'power3',
          overwrite: 'auto',
          duration: 0.6,
        })
      })
    })

    return () => {
      ctx.revert()
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [])

  return <>{children}</>
}
