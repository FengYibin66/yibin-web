'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerScrollAnimations } from '@/lib/animations/scrollAnimations'

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

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

    // Only register section scroll animations on /classic — those selectors
    // (#about, #skills, etc.) don't exist on /, /lab, or /gallery, which
    // would otherwise cause GSAP "target not found" warnings.
    if (pathname === '/classic') {
      const onLoad = () => {
        registerScrollAnimations()
        ScrollTrigger.refresh()
      }

      if (document.readyState === 'complete') {
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
    }

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      gsap.ticker.remove(tickerFn)
    }
  }, [pathname])

  return <>{children}</>
}
