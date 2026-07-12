import { galleryRooms, type GalleryImage } from '@/lib/gallery/data'

/**
 * Corridor mural placement (computed keep-outs)
 * ---------------------------------------------
 * Door alcove: DOOR_Z_SPAN = 4 → half = 2.0
 * Same-wall clearance beyond alcove edge: 4.5
 *   ⇒ door keep-out radius = 2.0 + 4.5 = 6.5
 *
 * Layout intent:
 *   1) Entrance: one frame per wall (R before Projects, L just past About)
 *   2) Facing doors: frames on the wall opposite a room door
 *   3) End gallery: dense run after Contact / tree (−68…−88)
 */

export type MuralSide = 'left' | 'right'

export interface CorridorMural {
  id: string
  side: MuralSide
  relativeZ: number
  y: number
  preferredWidth: number
  offsetFromWall: number
  image: string
  aspect: number
  signature: string
  galleryRoomId: string
}

export interface MuralKeepOut {
  side: MuralSide | 'both'
  z: number
  radius: number
  reason: string
}

export const MURAL_MAX_HEIGHT = 2.55
export const MURAL_MAX_WIDTH = 2.1
export const MURAL_MIN_WIDTH = 1.1
export const MURAL_DEFAULT_WIDTH = 1.75

/** From DoorSection.tsx */
export const DOOR_Z_SPAN = 4
export const DOOR_HALF_SPAN = DOOR_Z_SPAN / 2 // 2.0
/** Extra air beyond alcove edge before a frame may begin */
export const DOOR_EDGE_CLEARANCE = 4.5
export const DOOR_KEEP_RADIUS = DOOR_HALF_SPAN + DOOR_EDGE_CLEARANCE // 6.5

/**
 * Keep-outs — doors only block their own wall.
 * Furniture / ends as documented in CorridorDecorations / CorridorSegment.
 */
export const MURAL_KEEP_OUTS: readonly MuralKeepOut[] = [
  { side: 'both', z: -2, radius: 4.0, reason: 'welcome-avatar' },

  { side: 'left', z: -8, radius: DOOR_KEEP_RADIUS, reason: 'door-about' },
  { side: 'right', z: -20, radius: DOOR_KEEP_RADIUS, reason: 'door-projects' },
  { side: 'left', z: -32, radius: DOOR_KEEP_RADIUS, reason: 'door-publications' },
  { side: 'right', z: -44, radius: DOOR_KEEP_RADIUS, reason: 'door-gallery' },
  { side: 'left', z: -56, radius: DOOR_KEEP_RADIUS, reason: 'door-contact' },

  { side: 'left', z: -27, radius: 2.8, reason: 'desk' },
  { side: 'right', z: -49, radius: 2.4, reason: 'cabinet' },
  { side: 'left', z: -63, radius: 2.6, reason: 'potted-tree' },

  { side: 'both', z: -95, radius: 5.5, reason: 'segment-door' },
]

interface AlbumPick {
  albumId: string
  preferredCaptions: readonly string[]
}

const ALBUM_SEQUENCE: readonly AlbumPick[] = [
  { albumId: 'imperial', preferredCaptions: ['Graduation Ceremony', "Queen's Tower", 'Graduation Day'] },
  { albumId: 'ai4sg', preferredCaptions: ['CSCW with AI4SG'] },
  { albumId: 'paris', preferredCaptions: ['La Tour Eiffel', 'Paris Olympics', 'Palais Garnier I'] },
  { albumId: 'mcallister', preferredCaptions: ['Team Dinner', 'McAllister Bros', 'With Colleagues'] },
  { albumId: 'hs2', preferredCaptions: ['On Site', 'Under Euston Station', 'Geospatial Survey'] },
  { albumId: 'life', preferredCaptions: ['The Union', 'New Family', 'Beloved'] },
  { albumId: 'iceland', preferredCaptions: ['Glacier Waters', 'Northern Highlands', 'Arctic Light'] },
  { albumId: 'cornwall', preferredCaptions: ["St Michael's Mount", 'Minack Theatre', 'Coastal Path'] },
  { albumId: 'kualalumpur', preferredCaptions: ['University Friends', 'Penang Street Art', 'Campus Life'] },
  { albumId: 'imperial', preferredCaptions: ['Royal Albert Hall', 'Class of 2022', 'Friends'] },
  { albumId: 'paris', preferredCaptions: ['Sacré-Cœur', 'Grand Foyer', 'Eiffel at Dusk'] },
  { albumId: 'hs2', preferredCaptions: ['Lining Works, Oldfield Lane', 'Work in Progress', 'On Site'] },
  { albumId: 'life', preferredCaptions: ['Beloved', 'The Union', 'New Family'] },
  { albumId: 'mcallister', preferredCaptions: ['Team Photo', 'Afternoon Tea', 'Team Dinner'] },
  { albumId: 'iceland', preferredCaptions: ['Vast Plains', 'Mountain Pass', 'End of Day'] },
  { albumId: 'cornwall', preferredCaptions: ['Atlantic Shore', 'Coastal Path', 'Rainbow over Penzance'] },
]

/**
 * Anchors (same-wall door radius 6.5; opposite-door frames are intentional).
 *
 * Entrance:
 *   R (−13.5,−6) → −10   |  L just past About keep (−24.2,−14.5) → −17
 * Facing doors:
 *   R −32 ↔ Pubs L-32    |  L −44 ↔ Gallery R-44  |  R −58 ↔ Contact L-56
 * END free ≈ (−89.5, −65.6)
 */
const CANDIDATE_SLOTS: readonly {
  side: MuralSide
  relativeZ: number
  preferredWidth: number
  y: number
}[] = [
  // Entrance — one each side
  { side: 'right', relativeZ: -10.0, preferredWidth: 1.6, y: 0.16 },
  { side: 'left', relativeZ: -17.0, preferredWidth: 1.55, y: 0.18 },

  // Facing room doors (opposite wall)
  { side: 'right', relativeZ: -32.0, preferredWidth: 1.7, y: 0.14 }, // ↔ Publications
  { side: 'left', relativeZ: -44.0, preferredWidth: 1.65, y: 0.2 }, // ↔ Gallery
  { side: 'right', relativeZ: -58.0, preferredWidth: 1.7, y: 0.12 }, // ↔ Contact

  // Corridor end gallery
  { side: 'right', relativeZ: -68.0, preferredWidth: 1.85, y: 0.12 },
  { side: 'left', relativeZ: -71.5, preferredWidth: 1.8, y: 0.2 },
  { side: 'right', relativeZ: -75.0, preferredWidth: 1.75, y: 0.1 },
  { side: 'left', relativeZ: -78.5, preferredWidth: 1.9, y: 0.18 },
  { side: 'right', relativeZ: -82.0, preferredWidth: 1.7, y: 0.14 },
  { side: 'left', relativeZ: -85.5, preferredWidth: 1.85, y: 0.16 },
  { side: 'right', relativeZ: -88.5, preferredWidth: 1.55, y: 0.12 },
]

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function getMuralCollision(
  side: MuralSide,
  z: number,
  preferredWidth = MURAL_DEFAULT_WIDTH,
): string | null {
  const half = preferredWidth * 0.5
  const m0 = z - half
  const m1 = z + half

  for (const zone of MURAL_KEEP_OUTS) {
    if (zone.side !== 'both' && zone.side !== side) continue
    const k0 = zone.z - zone.radius
    const k1 = zone.z + zone.radius
    if (intervalsOverlap(m0, m1, k0, k1)) return zone.reason
  }
  return null
}

/** Edge-to-edge gap from mural footprint to nearest same-side door alcove. */
export function doorEdgeClearance(
  side: MuralSide,
  z: number,
  preferredWidth: number,
): number {
  const doorZs =
    side === 'left' ? ([-8, -32, -56] as const) : ([-20, -44] as const)
  const half = preferredWidth * 0.5
  let best = Infinity
  for (const dz of doorZs) {
    const muralNear = z < dz ? z + half : z - half
    const doorNear = z < dz ? dz - DOOR_HALF_SPAN : dz + DOOR_HALF_SPAN
    const gap = Math.abs(doorNear - muralNear)
    if (gap < best) best = gap
  }
  return best
}

export function fitMuralSize(
  aspect: number,
  preferredWidth: number,
  maxHeight = MURAL_MAX_HEIGHT,
  maxWidth = MURAL_MAX_WIDTH,
): { width: number; height: number } {
  const safeAspect = aspect > 0.05 ? aspect : 4 / 3
  let width = Math.min(preferredWidth, maxWidth)
  let height = width / safeAspect

  if (height > maxHeight) {
    height = maxHeight
    width = height * safeAspect
  }
  if (width < MURAL_MIN_WIDTH) {
    width = MURAL_MIN_WIDTH
    height = Math.min(width / safeAspect, maxHeight)
  }
  if (width > maxWidth) {
    width = maxWidth
    height = width / safeAspect
  }
  return { width, height }
}

function findAlbum(albumId: string) {
  const album = galleryRooms.find(r => r.id === albumId)
  if (!album || album.images.length === 0) {
    throw new Error(`corridorMurals: gallery album "${albumId}" missing or empty`)
  }
  return album
}

function pickImage(
  albumId: string,
  preferredCaptions: readonly string[],
  salt: number,
): GalleryImage {
  const album = findAlbum(albumId)
  for (const caption of preferredCaptions) {
    const hit = album.images.find(img => img.caption === caption)
    if (hit) return hit
  }
  return album.images[salt % album.images.length]!
}

function resolveAspect(img: GalleryImage): number {
  if (img.aspect && img.aspect > 0) return img.aspect
  return 4 / 3
}

function formatSignature(img: GalleryImage, albumTitle: string): string {
  return `${img.caption}\n${albumTitle} · ${img.year}`
}

export function getCorridorMurals(segmentIndex = 0): readonly CorridorMural[] {
  const safeIndex = Math.max(0, Math.floor(segmentIndex))
  const placed: CorridorMural[] = []

  for (let i = 0; i < CANDIDATE_SLOTS.length; i++) {
    const slot = CANDIDATE_SLOTS[i]!
    if (getMuralCollision(slot.side, slot.relativeZ, slot.preferredWidth)) continue

    // Enforce minimum door edge clearance (belt-and-suspenders)
    if (doorEdgeClearance(slot.side, slot.relativeZ, slot.preferredWidth) < DOOR_EDGE_CLEARANCE - 0.05) {
      continue
    }

    const half = slot.preferredWidth * 0.5
    const overlapsSibling = placed.some(p => {
      if (p.side !== slot.side) return false
      const ph = p.preferredWidth * 0.5
      const gap = 0.55
      return intervalsOverlap(
        slot.relativeZ - half - gap,
        slot.relativeZ + half + gap,
        p.relativeZ - ph,
        p.relativeZ + ph,
      )
    })
    if (overlapsSibling) continue

    const albumPick = ALBUM_SEQUENCE[(i + safeIndex * 2) % ALBUM_SEQUENCE.length]!
    const album = findAlbum(albumPick.albumId)
    const image = pickImage(albumPick.albumId, albumPick.preferredCaptions, safeIndex + i)

    placed.push({
      id: `m${placed.length + 1}-${slot.side[0]}${Math.abs(Math.round(slot.relativeZ))}`,
      side: slot.side,
      relativeZ: slot.relativeZ,
      y: slot.y,
      preferredWidth: slot.preferredWidth,
      offsetFromWall: 0.08,
      image: image.src,
      aspect: resolveAspect(image),
      signature: formatSignature(image, album.title),
      galleryRoomId: albumPick.albumId,
    })
  }

  return placed
}

export function getCorridorMuralTexturePaths(segmentCount = 3): readonly string[] {
  const paths = new Set<string>()
  for (let i = 0; i < segmentCount; i++) {
    for (const mural of getCorridorMurals(i)) paths.add(mural.image)
  }
  return [...paths]
}

export function assertMuralsClearKeepOuts(murals: readonly CorridorMural[]): void {
  for (const m of murals) {
    const reason = getMuralCollision(m.side, m.relativeZ, m.preferredWidth)
    if (reason) {
      throw new Error(`mural ${m.id} collides with keep-out "${reason}" at z=${m.relativeZ}`)
    }
    const gap = doorEdgeClearance(m.side, m.relativeZ, m.preferredWidth)
    if (gap < DOOR_EDGE_CLEARANCE - 0.05) {
      throw new Error(
        `mural ${m.id} door edge clearance ${gap.toFixed(2)} < ${DOOR_EDGE_CLEARANCE}`,
      )
    }
  }
}
