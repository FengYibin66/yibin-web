import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function animateIn(
  selector: string,
  trigger: string,
  vars: gsap.TweenVars,
  start = 'top 75%',
): void {
  gsap.from(selector, {
    ...vars,
    immediateRender: false, // don't hide elements before trigger fires
    scrollTrigger: { trigger, start, once: true },
  })
}

function animateBlur(selector: string, trigger: string, start = 'top 82%'): void {
  gsap.from(selector, {
    filter: 'blur(12px)',
    opacity: 0,
    y: 16,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power2.out',
    immediateRender: false,
    scrollTrigger: { trigger, start, once: true },
  })
}

export function registerScrollAnimations(): void {
  // Blur reveal — scoped to each section's title
  ;['#about', '#skills', '#experience', '#projects', '#publications', '#contact'].forEach(id => {
    animateBlur(`${id} .section-title-text`, id, 'top 88%')
  })

  // About section — bio + stats fade in from below
  animateIn('#about .animate-in', '#about', { opacity: 0, y: 40, duration: 0.7, stagger: 0.1, ease: 'power2.out' })

  // Skills section — badges fly in from left
  animateIn('#skills .skill-badge', '#skills', { opacity: 0, x: -30, duration: 0.5, stagger: 0.04, ease: 'power2.out' })

  // Experience section — timeline items slide in
  animateIn('#experience .timeline-item', '#experience', { opacity: 0, y: 50, duration: 0.6, stagger: 0.15, ease: 'power2.out' }, 'top 70%')

  // Projects section — cards scale + fade in
  animateIn('#projects .project-card', '#projects', { opacity: 0, scale: 0.92, duration: 0.6, stagger: 0.08, ease: 'back.out(1.2)' })

  // Publications section — cards fade in from below
  animateIn('#publications .publication-card', '#publications', { opacity: 0, y: 50, duration: 0.7, stagger: 0.1, ease: 'power2.out' })

  // Contact section — links fade in
  animateIn('#contact .contact-item', '#contact', { opacity: 0, y: 30, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 'top 80%')

  // Education cards — 3D flip entrance
  animateIn('#about .edu-card', '#about', {
    opacity: 0,
    rotateX: -50,
    transformPerspective: 800,
    duration: 0.7,
    stagger: 0.12,
    ease: 'back.out(1.4)',
  }, 'top 70%')
}
