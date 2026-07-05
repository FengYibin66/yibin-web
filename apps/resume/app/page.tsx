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

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
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
