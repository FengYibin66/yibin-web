'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerScrollAnimations } from '@/lib/animations/scrollAnimations'
import { Navbar, Footer } from '@/components/layout'
import {
  HeroSection,
  AboutSection,
  EducationSection,
  SkillsSection,
  ExperienceSection,
  ProjectsSection,
  PublicationsSection,
  ContactSection,
  GalleryDoorSection,
} from '@/components/sections'
import { CredentialsSection } from '@/components/classic/CredentialsViews'

export default function ClassicPage() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

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
    }
  }, [])

  return (
    <>
      <Navbar brandHref="/" />
      <a
        href="/"
        style={{
          position: 'fixed', top: '20px', left: '20px', zIndex: 100,
          fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: 'var(--text-secondary)', textDecoration: 'none',
          letterSpacing: '0.08em', opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
      >
        ← Home
      </a>
      <main>
        <HeroSection />
        <AboutSection />
        <EducationSection />
        <SkillsSection />
        <ExperienceSection />
        <ProjectsSection />
        <PublicationsSection />
        <CredentialsSection />
        <ContactSection />
        <GalleryDoorSection />
      </main>
      <Footer />
    </>
  )
}
