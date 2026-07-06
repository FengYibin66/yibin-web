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

    lenis.on('scroll', ({ velocity }: { velocity: number }) => {
      gsap.to('[data-skew]', {
        skewY: velocity * 0.35,
        ease: 'power3',
        overwrite: 'auto',
        duration: 0.6,
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [])

  return <>{children}</>
}
