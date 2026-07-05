'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerScrollAnimations } from '@/lib/animations/scrollAnimations'

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value?: number) {
        if (value !== undefined) lenis.scrollTo(value, { immediate: true })
        return lenis.scroll
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      },
    })

    lenis.on('scroll', ScrollTrigger.update)

    const tickerFn = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(tickerFn)
    gsap.ticker.lagSmoothing(0)

    // Register scroll-triggered animations after Lenis is ready
    registerScrollAnimations()

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [])

  return <>{children}</>
}
