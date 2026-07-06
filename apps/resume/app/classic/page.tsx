import { ClassicNavbar, Footer } from '@/components/layout'
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
  return (
    <>
      <ClassicNavbar />
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
