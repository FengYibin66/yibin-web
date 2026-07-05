export type Locale = 'en' | 'zh'

export interface NavContent {
  brand: string
  links: { label: string; href: string }[]
}

export interface HeroContent {
  greeting: string
  name: string
  nameZh: string
  roles: string[]
  tagline: string
  cta: string
  scrollHint: string
}

export interface AboutContent {
  title: string
  bio: string[]
  stats: { value: string; label: string }[]
  education: {
    school: string
    degree: string
    field: string
    period: string
    note?: string
    logo?: string
  }[]
}

export interface SkillGroup {
  title: string
  skills: string[]
}

export interface ExperienceItem {
  company: string
  role: string
  period: string
  location: string
  bullets: string[]
  images?: string[]
}

export interface ProjectItem {
  name: string
  description: string
  tech: string[]
  status: 'live' | 'dev'
  url?: string
}

export interface PublicationItem {
  title: string
  venue: string
  year: number
  authors: string
  doi?: string
  keywords: string[]
  abstract?: string
  featured?: boolean
  image?: string
}

export interface ContactContent {
  title: string
  subtitle: string
  email: string
  github: string
  linkedin: string
  copyLabel: string
  copiedLabel: string
}

export interface FooterContent {
  copyright: string
  builtWith: string
}

export interface SiteContent {
  nav: NavContent
  hero: HeroContent
  about: AboutContent
  skills: { title: string; groups: SkillGroup[] }
  experience: { title: string; items: ExperienceItem[] }
  projects: { title: string; items: ProjectItem[] }
  publications: { title: string; items: PublicationItem[] }
  contact: ContactContent
  footer: FooterContent
}
