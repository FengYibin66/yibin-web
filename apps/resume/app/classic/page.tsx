'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerScrollAnimations } from '@/lib/animations/scrollAnimations'
import { Navbar, Footer } from '@/components/layout'
import {
  HeroSection,
  AboutSection,
  SkillsSection,
  ExperienceSection,
  ProjectsSection,
  PublicationsSection,
  ContactSection,
  GalleryDoorSection,
} from '@/components/sections'

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
      <main>
        <HeroSection />
        <AboutSection />
        <SkillsSection />
        <ExperienceSection />
        <ProjectsSection />
        <PublicationsSection />
        <ContactSection />
        <GalleryDoorSection />
      </main>
      <Footer />
    </>
  )
}
