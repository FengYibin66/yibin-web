import { content, type Locale } from '@/lib/content'
import type { ProjectItem } from '@/lib/content/types'

export type ProjectPlatform = 'blog' | 'youtube' | 'tiktok'

export interface ProjectRoomItem {
  id: string
  title: string
  sub: string
  url?: string
  platform: ProjectPlatform
}

const PLATFORM_CYCLE: readonly ProjectPlatform[] = ['blog', 'youtube', 'tiktok', 'blog']

/**
 * Pick a compact set of projects for the 3D monitor tower.
 * Prefer personal live projects, then Epic, then Xueersi highlights —
 * capped so the tower stays readable.
 */
export function getProjectRoomItems(locale: Locale, limit = 4): readonly ProjectRoomItem[] {
  const categories = content[locale].projects.categories
  const picked: ProjectItem[] = []

  const personal = categories.find(c => c.id === 'personal')
  for (const item of personal?.items ?? []) {
    if (picked.length >= limit) break
    picked.push(item)
  }

  const epic = categories.find(c => c.id === 'epic')
  for (const item of epic?.items ?? []) {
    if (picked.length >= limit) break
    picked.push(item)
  }

  // Fill from Xueersi flat groups if still short
  if (picked.length < limit) {
    const xueersi = categories.find(c => c.id === 'xueersi')
    for (const group of xueersi?.groups ?? []) {
      for (const item of group.items) {
        if (picked.length >= limit) break
        picked.push(item)
      }
      if (picked.length >= limit) break
    }
  }

  return picked.map((item, i) => ({
    id: `${item.name}-${i}`,
    title: item.name,
    sub: item.tech.slice(0, 3).join(' · ') || item.description.slice(0, 42),
    url: item.url,
    platform: PLATFORM_CYCLE[i % PLATFORM_CYCLE.length]!,
  }))
}
