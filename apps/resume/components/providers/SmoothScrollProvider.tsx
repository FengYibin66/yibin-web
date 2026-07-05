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

    // Drive GSAP ticker with Lenis RAF
    const tickerFn = (time: number) => { lenis.raf(time * 1000) }
    gsap.ticker.add(tickerFn)
    gsap.ticker.lagSmoothing(0)

    // Keep ScrollTrigger in sync with Lenis scroll position
    lenis.on('scroll', ScrollTrigger.update)

    // Scroll velocity skew — applies to elements with data-skew attribute
    lenis.on('scroll', ({ velocity }: { velocity: number }) => {
      gsap.to('[data-skew]', {
        skewY: velocity * 0.35,
        ease: 'power3',
        overwrite: 'auto',
        duration: 0.6,
      })
    })

    // Register animations once the page is fully loaded (DOM + images settled).
    // Using 'load' guarantees all elements exist and have final dimensions,
    // so ScrollTrigger.refresh() computes accurate trigger positions.
    const onLoad = () => {
      registerScrollAnimations()
      ScrollTrigger.refresh()
    }

    if (document.readyState === 'complete') {
      // Already loaded (e.g. client-side navigation)
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }

    return () => {
      window.removeEventListener('load', onLoad)
      ScrollTrigger.getAll().forEach(t => t.kill())
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [])

  return <>{children}</>
}
