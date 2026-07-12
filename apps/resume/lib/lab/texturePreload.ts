'use client'

import { useTexture } from '@react-three/drei'
import { getCorridorMuralTexturePaths } from '@/lib/lab/corridorMurals'

/**
 * Texture preload lists.
 *
 * Calling useTexture.preload() for every known texture at module-load time
 * registers all requests with three's LoadingManager in a single wave,
 * instead of the suspense waterfall (one texture per component re-render)
 * that produces multiple 0→100% progress cycles. This keeps the progress
 * indicators accurate and lets loaders exit exactly once, when everything
 * is actually in memory.
 */

const DOOR_TYPES = ['about', 'projekty', 'kontakt', 'social'] as const

export const CORRIDOR_TEXTURES: string[] = [
  // Corridor geometry
  '/textures/corridor/wall_texture.webp',
  '/textures/corridor/ceiling_texture.webp',
  '/textures/corridor/kawalekpodlogi.webp',
  '/textures/corridor/texturadoprogow.webp',
  '/textures/corridor/kratanalampy.webp',
  '/textures/corridor/kratkawentylacyjna.webp',
  '/textures/corridor/bokilampy.webp',
  '/textures/corridor/window_sketch.webp',

  // Doors (all type variants + shared frame/handles)
  ...DOOR_TYPES.flatMap(type => [
    `/textures/corridor/doors/drzwi${type}.webp`,
    `/textures/corridor/doors/drzwi${type}_painted.webp`,
  ]),
  '/textures/corridor/doors/ramkasingledoors.webp',
  '/textures/corridor/doors/backsingledoors.webp',
  '/textures/corridor/doors/doorrleft.webp',
  '/textures/corridor/doors/dorright.webp',
  '/textures/corridor/doors/klamkadodrzwi.webp',
  '/textures/corridor/doors/klamkadodrzwi_painted.webp',
  '/textures/corridor/pustatabliczka.webp',
  '/textures/corridor/strzalka.webp',

  // Decorations
  '/textures/corridor/decorations/coffee_debug.webp',
  '/textures/corridor/decorations/idea_process.webp',
  '/textures/corridor/decorations/while_true_loop.webp',
  '/textures/corridor/ramkanazdjecieduza.webp',
  '/textures/corridor/ramkanazdjecieduza_painted.webp',
  '/textures/corridor/ramkanazdjeciemala.webp',
  '/textures/corridor/drzewkowdoniczce.webp',
  '/textures/corridor/kwiatekwdoniczce.webp',
  '/textures/corridor/gorastolika.webp',
  '/textures/corridor/szafkaprzod.webp',
  '/textures/corridor/szafkaprzodgora.webp',
  '/textures/corridor/texturadrewnadonozekbiurka.webp',

  // Welcome area (avatar animation frames, doodles, cat, easter eggs)
  ...Array.from({ length: 9 }, (_, i) => `/textures/corridor/avatar_anim/${i + 1}.webp`),
  '/textures/corridor/avatar_window.webp',
  '/textures/corridor/doodles/coffee_cup.webp',
  '/textures/corridor/doodles/paper_airplane.webp',
  '/textures/corridor/doodles/paper_ball.webp',
  '/textures/corridor/doodles/pencil.webp',
  '/textures/corridor/cat_body.webp',
  '/textures/corridor/bug_sketch.webp',
  '/textures/corridor/ink_splash.webp',

  // Gallery photos used as corridor murals (first 3 segments)
  ...getCorridorMuralTexturePaths(3),
]

export const ENTRANCE_TEXTURES: string[] = [
  '/textures/entrance/wall_bricks_2.webp',
  '/textures/entrance/floor_paper.webp',
  '/textures/entrance/tree_sketch.webp',
  '/textures/entrance/mouse_hanging.webp',
  '/textures/entrance/window_sketch.webp',
  '/textures/entrance/avatar_window.webp',
  '/textures/entrance/pot_with_duck.webp',
  '/textures/entrance/stone-path.webp',
  '/textures/entrance/sign.webp',
  '/textures/entrance/speech_bubble.webp',
  '/textures/entrance/bug_sketch.webp',
  '/textures/corridor/ink_splash.webp',
  '/textures/corridor/cat_body.webp',
  // Entrance door reuses corridor door assets
  '/textures/corridor/doors/ramkasingledoors.webp',
  '/textures/corridor/doors/drzwiabout.webp',
  '/textures/corridor/doors/drzwiabout_painted.webp',
  '/textures/corridor/doors/klamkadodrzwi.webp',
  '/textures/corridor/doors/klamkadodrzwi_painted.webp',
]

export function preloadCorridorTextures(): void {
  console.info(`[progress] preloading ${CORRIDOR_TEXTURES.length} corridor textures`)
  CORRIDOR_TEXTURES.forEach(url => useTexture.preload(url))
}

export function preloadEntranceTextures(): void {
  console.info(`[progress] preloading ${ENTRANCE_TEXTURES.length} entrance textures`)
  ENTRANCE_TEXTURES.forEach(url => useTexture.preload(url))
}
