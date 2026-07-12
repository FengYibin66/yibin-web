export const PUBLICATION_CAROUSEL_ITEM_GAP = 2.5
export const PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY = 0.005
export const PUBLICATION_CAROUSEL_LERP_SPEED = 5
export const PUBLICATION_CAROUSEL_MAX_DELTA_ULPS = 4

/**
 * Numbers mirrored from portfolio-itom GalleryRoom ProjectCard.openCard/closeCard.
 * Present anchor is in clothesline-group local space (not camera space).
 */
export const PUBLICATION_CARD_MOTION = {
  open: {
    hangY: -1.1,
    /** Clothesline-local reading pose (desktop). Paper local = anchor - slot.position */
    presentAnchor: { x: 0, y: 0.1, z: 1.5 },
    detachY: 0.5,
    detachRotX: 0.5,
    detachRotZ: -0.05,
    detachBend: 0.8,
    detachDuration: 0.15,
    detachEase: 'power2.out',
    midY: 0.4,
    midAnchorMix: 0.2,
    midRotX: Math.PI * 0.8,
    midRotY: -0.02,
    midRotZ: 0.05,
    midBend: -0.3,
    midDuration: 0.4,
    midPosEase: 'power1.out',
    midRotEase: 'power1.inOut',
    presentDuration: 0.4,
    presentEase: 'power3.out',
    presentBend: 0,
    presentBendDuration: 0.5,
    presentBendEase: 'power2.out',
    scale: 1.0,
    scaleDuration: 0.3,
    scaleEase: 'sine.out',
    progress: 1,
    windStrength: 0,
  },
  close: {
    midDuration: 0.35,
    midEase: 'power2.in',
    midY: -0.5,
    midZ: 1,
    midRotX: 0.5,
    midRotZ: -0.05,
    midBend: 0.6,
    hangDuration: 0.25,
    hangEase: 'power3.out',
  },
  /**
   * Corridor entry leaves the camera off the clothesline axis. itom's present
   * pose assumes the camera already stands on that axis looking at the paper.
   * We recreate that reading station: move onto clothesline +Z, look at present.
   * Browse settle runs once after enterRoom so hanging cards are viewport-centered.
   */
  cameraFrame: {
    duration: 0.55,
    ease: 'power2.inOut',
    /** World-space distance along clothesline +Z in front of the present point. */
    readingDistance: 3.4,
    /** Distance for the post-entry hang browse view (see several cards). */
    browseDistance: 5,
    /** Clothesline-local look-at for hang browse (rope center, paper mid-height). */
    browseLookAt: { x: 0, y: 0.7, z: -3 },
    browseDuration: 0.7,
    browseEase: 'power2.inOut',
  },
} as const
