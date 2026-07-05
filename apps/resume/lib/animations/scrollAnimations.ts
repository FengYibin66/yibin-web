import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function registerScrollAnimations(): void {
  // About section — bio + stats fade in from below
  gsap.from('#about .animate-in', {
    opacity: 0,
    y: 40,
    duration: 0.7,
    stagger: 0.1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#about',
      start: 'top 75%',
      once: true,
    },
  })

  // Skills section — badges fly in from left
  gsap.from('#skills .skill-badge', {
    opacity: 0,
    x: -30,
    duration: 0.5,
    stagger: 0.04,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#skills',
      start: 'top 75%',
      once: true,
    },
  })

  // Experience section — timeline items slide in
  gsap.from('#experience .timeline-item', {
    opacity: 0,
    y: 50,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#experience',
      start: 'top 70%',
      once: true,
    },
  })

  // Projects section — cards scale + fade in
  gsap.from('#projects .project-card', {
    opacity: 0,
    scale: 0.92,
    duration: 0.6,
    stagger: 0.08,
    ease: 'back.out(1.2)',
    scrollTrigger: {
      trigger: '#projects',
      start: 'top 75%',
      once: true,
    },
  })

  // Publications section — cards fade in from below
  gsap.from('#publications .publication-card', {
    opacity: 0,
    y: 50,
    duration: 0.7,
    stagger: 0.1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#publications',
      start: 'top 75%',
      once: true,
    },
  })

  // Contact section — links fade in
  gsap.from('#contact .contact-item', {
    opacity: 0,
    y: 30,
    duration: 0.5,
    stagger: 0.1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#contact',
      start: 'top 80%',
      once: true,
    },
  })
}
