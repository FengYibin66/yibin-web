'use client'

import { useEffect } from 'react'
import { mountScrollReveal } from '@/lib/animations/scrollReveal'
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
  /*
    滚动显形的生命周期归本组件所有：只撤销自己挂的（`handle.revert()`），
    **不**清全局——前身的 `ScrollTrigger.getAll().forEach(t => t.kill())` 会连带杀掉
    播放中的 tween 与别人的触发器，StrictMode 双跑 effect 时把卡片留在半透明
    （2026-09-07 实机；细节见 lib/animations/scrollReveal.ts 顶部与 ADR 20260907120701）。

    放在 rAF 里：客户端导航带 hash 进来时，让 Next 的 hash 滚动与 Lenis 先就位，
    挂载时才知道哪些区已经在视口上方、该直接呈现而不是补播。
    ScrollTrigger 自己监听 load / resize 并 refresh，不需要再等 `load`。
  */
  useEffect(() => {
    let handle: ReturnType<typeof mountScrollReveal> | null = null
    const raf = requestAnimationFrame(() => {
      handle = mountScrollReveal()
    })
    return () => {
      cancelAnimationFrame(raf)
      handle?.revert()
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
