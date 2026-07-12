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

export interface EducationEntry {
  id: string
  school: string
  degree: string
  field: string
  period: string
  note?: string
  logo?: string
  /** e.g. "QS #8" — shown as a prominent badge */
  qsRank?: string
  /** e.g. "Global Rank" / "全球排名" */
  qsLabel?: string
  location?: string
  keyModules?: string[]
}

export interface AboutHighlight {
  title: string
  description: string
}

export interface AboutContent {
  title: string
  bio: string[]
  highlights: AboutHighlight[]
}

export interface EducationContent {
  title: string
  subtitle?: string
  keyModulesLabel: string
  viewEducationLabel: string
  items: EducationEntry[]
}

export interface SkillGroup {
  title: string
  skills: string[]
}

export interface MediaImage {
  src: string
  caption: string
  explanation?: string
}

export interface ExperienceDetail {
  intro?: string
  heroImage?: string
  video?: { title: string; youtubeId: string }
  sections: { title: string; bullets: string[] }[]
  caseStudy?: {
    title: string
    overview: string
    challengesTitle: string
    challenges: string[]
    solutionsTitle: string
    solutionsIntro?: string
    solutions: string[]
    achievementsTitle: string
    achievements: string[]
    images: MediaImage[]
  }
  gallery?: {
    title: string
    images: MediaImage[]
  }
}

export interface ExperienceItem {
  id: string
  company: string
  role: string
  period: string
  location: string
  bullets: string[]
  /** Hero/cover image shown on the timeline card */
  coverImage?: string
  coverAlt?: string
  /** Optional org logo (e.g. lab brand mark) */
  logo?: string
  /** Official site */
  companyUrl?: string
  images?: string[]
  detail?: ExperienceDetail
}

export type ProjectStatus = 'live' | 'dev' | 'internal' | 'archive'

export interface ProjectItem {
  name: string
  description: string
  tech: string[]
  status?: ProjectStatus
  url?: string
}

export interface ProjectGroup {
  title: string
  summary?: string
  items: ProjectItem[]
}

export interface ProjectCategory {
  id: string
  title: string
  summary?: string
  items?: ProjectItem[]
  groups?: ProjectGroup[]
}

export interface PublicationLink {
  label: string
  url: string
}

export interface PublicationItem {
  id: string
  title: string
  venue: string
  year: number
  authors: string
  /** ACM / DOI landing page when available */
  doi?: string
  keywords: string[]
  abstract?: string
  /** One-line takeaway on Classic L1 cards */
  takeaway?: string
  /** Bullet highlights for Classic detail (L2) */
  highlights?: string[]
  citations?: number
  role?: 'first' | 'coauthor'
  featured?: boolean
  image?: string
  links?: PublicationLink[]
}

export interface PublicationsContent {
  title: string
  scholarUrl: string
  scholarLabel: string
  readHighlightsLabel: string
  citationsLabel: string
  firstAuthorLabel: string
  stats?: { citations: number; hIndex: number; i10: number }
  items: PublicationItem[]
}

export interface CredentialItem {
  id: string
  title: string
  level?: string
  note?: string
  image?: string
}

export interface CredentialsContent {
  title: string
  awardsTitle: string
  certificatesTitle: string
  viewAllLabel: string
  backLabel: string
  awards: CredentialItem[]
  certificates: CredentialItem[]
}

export interface ContactContent {
  title: string
  subtitle: string
  contactMeLabel: string
  followMeLabel: string
  email: string
  emailSecondary?: string
  phone?: string
  github: string
  linkedin: string
  wechatQr?: string
  facebook?: string
  instagram?: string
  copyLabel: string
  copiedLabel: string
}

export interface FooterContent {
  copyright: string
  builtWith: string
}

export interface ClassicUiLabels {
  learnMore: string
  backToClassic: string
}

export interface SiteContent {
  nav: NavContent
  hero: HeroContent
  about: AboutContent
  education: EducationContent
  skills: { title: string; groups: SkillGroup[] }
  experience: { title: string; learnMoreLabel: string; items: ExperienceItem[] }
  projects: { title: string; categories: ProjectCategory[] }
  publications: PublicationsContent
  credentials: CredentialsContent
  contact: ContactContent
  footer: FooterContent
  classicUi: ClassicUiLabels
}
