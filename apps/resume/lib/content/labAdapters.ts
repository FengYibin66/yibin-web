import { content, type Locale } from '@/lib/content'

export interface AboutRoomCopy {
  name: string
  rolesLine: string
  tagline: string
  journeyTitle: string
  journeySubtitle: string
  leftIslandLabel: string
  rightIslandLabel: string
  skillsTitle: string
  skills: readonly string[]
}

/**
 * About 3D room copy derived from Classic content (locale-aware).
 */
export function getAboutRoomCopy(locale: Locale): AboutRoomCopy {
  const c = content[locale]
  const nus = c.education.items.find(e => e.id === 'nus')
  const imperial = c.education.items.find(e => e.id === 'imperial')
  const epic = c.experience.items.find(e => e.id === 'epic')

  const skills = c.skills.groups
    .flatMap(g => g.skills)
    .slice(0, 8)

  return {
    name: c.hero.name.toUpperCase(),
    rolesLine: c.hero.roles.slice(0, 2).join(' · '),
    tagline: c.hero.tagline,
    journeyTitle: locale === 'zh' ? '旅程' : 'JOURNEY',
    journeySubtitle: locale === 'zh' ? '教育与经历' : 'Education & Experience',
    leftIslandLabel: nus
      ? `NUS ${nus.period.replace(/\s+/g, '')}`
      : 'NUS',
    rightIslandLabel: epic
      ? `Epic! ${epic.period.includes('至今') || /present|now/i.test(epic.period) ? 'NOW' : epic.period}`
      : imperial
        ? `Imperial ${imperial.period.replace(/\s+/g, '')}`
        : 'TAL',
    skillsTitle: locale === 'zh' ? '技能' : 'SKILLS',
    skills,
  }
}

export interface ContactRoomLinks {
  linkedin: string
  github: string
  emailMailto: string
  wechatQr?: string
}

export function getContactRoomLinks(locale: Locale): ContactRoomLinks {
  const c = content[locale].contact
  return {
    linkedin: c.linkedin,
    github: c.github,
    emailMailto: `mailto:${c.email}`,
    wechatQr: c.wechatQr,
  }
}
