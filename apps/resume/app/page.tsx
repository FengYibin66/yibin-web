import dynamic from 'next/dynamic'
import { Navbar, Footer } from '@/components/layout'
import {
  HeroSection,
  AboutSection,
  SkillsSection,
  ExperienceSection,
  ProjectsSection,
  PublicationsSection,
  ContactSection,
} from '@/components/sections'

const HeroCanvas = dynamic(
  () => import('@/components/canvas/HeroCanvas'),
  { ssr: false }
)

export default function Home() {
  return (
    <>
      <HeroCanvas />
      <Navbar />
      <main className="relative" style={{ zIndex: 10 }}>
        <HeroSection />
        <AboutSection />
        <SkillsSection />
        <ExperienceSection />
        <ProjectsSection />
        <PublicationsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
