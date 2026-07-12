import { describe, expect, it } from 'vitest'
import {
  getCorridorMurals,
  getCorridorMuralTexturePaths,
  fitMuralSize,
  MURAL_MAX_HEIGHT,
  assertMuralsClearKeepOuts,
  doorEdgeClearance,
  DOOR_EDGE_CLEARANCE,
} from '@/lib/lab/corridorMurals'
import { galleryRooms } from '@/lib/gallery/data'
import { getAboutRoomCopy, getContactRoomLinks } from '@/lib/content/labAdapters'
import { getProjectRoomItems } from '@/lib/content/projectsRoom'
import { content } from '@/lib/content'

describe('fitMuralSize (fixed width, height follows aspect)', () => {
  it('keeps preferred width for landscape and derives height', () => {
    const { width, height } = fitMuralSize(4 / 3, 1.8)
    expect(width).toBeCloseTo(1.8, 5)
    expect(height).toBeCloseTo(1.8 / (4 / 3), 5)
  })

  it('shrinks width when portrait would exceed max height (no empty letterbox)', () => {
    const { width, height } = fitMuralSize(3 / 4, 2.0)
    expect(height).toBeLessThanOrEqual(MURAL_MAX_HEIGHT + 1e-6)
    expect(width / height).toBeCloseTo(3 / 4, 5)
    expect(width).toBeLessThan(2.0)
  })
})

describe('corridor murals from Gallery', () => {
  it('places entrance + door-facing frames, then densifies the end', () => {
    const murals = getCorridorMurals(0)
    expect(murals.length).toBeGreaterThanOrEqual(10)
    expect(murals.length).toBeLessThanOrEqual(14)

    const entrance = murals.filter(m => m.relativeZ > -25)
    expect(entrance.some(m => m.side === 'left')).toBe(true)
    expect(entrance.some(m => m.side === 'right')).toBe(true)

    // Opposite wall of Pubs / Gallery / Contact
    const zs = new Set(murals.map(m => `${m.side}:${m.relativeZ}`))
    expect(zs.has('right:-32')).toBe(true)
    expect(zs.has('left:-44')).toBe(true)
    expect(zs.has('right:-58')).toBe(true)

    const end = murals.filter(m => m.relativeZ <= -60)
    expect(end.length).toBeGreaterThanOrEqual(6)
  })

  it('never places murals in door / furniture keep-out zones', () => {
    for (const seg of [0, 1, 2]) {
      assertMuralsClearKeepOuts(getCorridorMurals(seg))
    }
  })

  it('keeps ≥4.5 edge clearance from same-side door alcoves', () => {
    for (const m of getCorridorMurals(0)) {
      expect(doorEdgeClearance(m.side, m.relativeZ, m.preferredWidth)).toBeGreaterThanOrEqual(
        DOOR_EDGE_CLEARANCE - 0.05,
      )
    }
  })

  it('includes AI4SG / research or travel albums across placement', () => {
    const albums = new Set(getCorridorMurals(0).map(m => m.galleryRoomId))
    expect(albums.size).toBeGreaterThanOrEqual(4)
  })

  it('rotates albums across segments', () => {
    const s0 = getCorridorMurals(0).map(m => m.galleryRoomId).join(',')
    const s1 = getCorridorMurals(1).map(m => m.galleryRoomId).join(',')
    expect(s0).not.toEqual(s1)
  })

  it('exposes preload texture paths from gallery', () => {
    const paths = getCorridorMuralTexturePaths(2)
    expect(paths.length).toBeGreaterThanOrEqual(6)
    paths.forEach(p => expect(p).toMatch(/^\/gallery\//))
  })
})

describe('lab content adapters', () => {
  it('About copy pulls hero + education + experience + skills', () => {
    const copy = getAboutRoomCopy('zh')
    expect(copy.name).toContain('YIBIN')
    expect(copy.rolesLine).toContain('AI Research Engineer')
    expect(copy.leftIslandLabel).toMatch(/NUS/)
    expect(copy.rightIslandLabel).toMatch(/Epic/)
    expect(copy.skills.length).toBeGreaterThan(0)
    expect(copy.tagline).toBe(content.zh.hero.tagline)
  })

  it('Contact links match Classic', () => {
    const links = getContactRoomLinks('en')
    expect(links.github).toBe(content.en.contact.github)
    expect(links.linkedin).toBe(content.en.contact.linkedin)
    expect(links.emailMailto).toBe(`mailto:${content.en.contact.email}`)
  })

  it('Projects room picks up to 4 items from Classic categories', () => {
    const items = getProjectRoomItems('zh', 4)
    expect(items.length).toBe(4)
    expect(items[0]?.title).toBeTruthy()
    expect(items.some(i => i.url)).toBe(true)
  })

  it('includes AI4SG Research Student experience in Classic', () => {
    const zh = content.zh.experience.items.find(i => i.id === 'ai4sg')
    const en = content.en.experience.items.find(i => i.id === 'ai4sg')
    expect(zh?.role).toBe('Research Student')
    expect(zh?.companyUrl).toBe('https://www.ai4sg.org/')
    expect(zh?.coverImage).toBe('/experience/03-ai4sg.jpg')
    expect(zh?.logo).toBe('/brands/ai4sg-logo.png')
    // group photo only once (cover), not duplicated in thumbs
    expect(zh?.images ?? []).toHaveLength(0)
    expect(en?.images ?? []).toHaveLength(0)
    expect(en?.bullets.join(' ')).toMatch(/Yi-Chieh|EJ Lee/)
    expect(content.zh.about.bio.join(' ')).toMatch(/AI4SG/)
    expect(content.en.about.bio.join(' ')).toMatch(/AI4SG/)
  })
})
