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
      {/*
        这里曾有一个 `position: fixed; top:20; left:20` 的「← Home」链接，已删除。
        它与 Navbar 的品牌指向同一个 URL（`brandHref="/"`），是功能重复；而且它不在
        任何布局容器里，桌面上「刚好不撞」纯属巧合——Navbar 的 `max-w-6xl mx-auto px-6`
        把品牌推到 x≈88，而手机上容器不再约束、品牌落在 x=24，与它 92% 重叠
        （实测 2026-09-09：品牌 [24,18 90×28] × 链接 [20,20 49×18]）。
        回首页的职责由品牌承担，这是 web 上最强的既有约定。
      */}
      <Navbar brandHref="/" />
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
