import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitType from 'split-type'

gsap.registerPlugin(ScrollTrigger)

// Animate a heading with word-level stagger reveal on scroll
export function revealWords(element: HTMLElement, delay = 0): void {
  const split = new SplitType(element, { types: 'words' })
  gsap.from(split.words ?? [], {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.05,
    delay,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: element,
      start: 'top 85%',
      once: true,
    },
  })
}

// Animate a heading with character-level stagger (for hero h1)
export function revealChars(element: HTMLElement, delay = 0): void {
  const split = new SplitType(element, { types: 'chars' })
  gsap.from(split.chars ?? [], {
    opacity: 0,
    y: 30,
    duration: 0.5,
    stagger: 0.03,
    delay,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: element,
      start: 'top 90%',
      once: true,
    },
  })
}
