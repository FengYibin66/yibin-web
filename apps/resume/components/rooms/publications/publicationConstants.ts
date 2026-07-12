export const PUBLICATION_CAROUSEL_ITEM_GAP = 2.5
export const PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY = 0.005
export const PUBLICATION_CAROUSEL_LERP_SPEED = 5
export const PUBLICATION_CAROUSEL_MAX_DELTA_ULPS = 4

export const PUBLICATION_CARD_MOTION = {
  open: {
    detachY: 0.3,
    detachBend: 0.8,
    detachRotationX: -0.08,
    detachRotationZ: 0,
    detachDuration: 0.15,
    detachEase: 'power2.out',
    liftY: 1.5,
    liftBend: 0.4,
    flipRatio: 0.8,
    liftDuration: 0.25,
    liftEase: 'power3.out',
    centerRotationX: Math.PI,
    centerRotationY: 0,
    centerRotationZ: 0,
    centerDuration: 0.5,
    centerEase: 'power3.out',
    scale: 1.1,
    settleBend: 0,
    settleDuration: 0.2,
    settleEase: 'power2.out',
    windStrength: 0,
    progress: 1,
  },
  close: {
    zoomDuration: 0.2,
    zoomEase: 'power2.in',
    centerDuration: 0.5,
    centerEase: 'power3.in',
    lowerDuration: 0.25,
    lowerEase: 'power3.in',
    attachDuration: 0.15,
    attachEase: 'power2.in',
  },
} as const
