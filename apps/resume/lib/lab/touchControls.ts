/**
 * Pure math for corridor touch controls — extracted for unit testing.
 *
 * Mobile control scheme (FPS-style):
 *   vertical drag   → walk forward/back (Z axis)
 *   horizontal drag → turn / look left-right (incremental, persists on release)
 */

/** How much of the full look range a full-viewport-width drag covers */
const TOUCH_LOOK_SENSITIVITY = 1.6

/** Matches the historical touch walk speed (scrollSpeed * 1.5 per px) */
const TOUCH_WALK_MULTIPLIER = 1.5

/**
 * Next camera target Z after a vertical drag step.
 * Finger up (deltaYPx < 0) walks forward (-Z), finger down walks backward.
 */
export function nextTargetZ(targetZ: number, deltaYPx: number, scrollSpeed: number): number {
  return targetZ + deltaYPx * scrollSpeed * TOUCH_WALK_MULTIPLIER
}

/**
 * Next horizontal look target after a horizontal drag step.
 * Finger right (deltaXPx > 0) looks right. Clamped to ±intensity so the
 * camera can never over-rotate; the value persists when the finger lifts.
 */
export function nextLookX(
  currentLookX: number,
  deltaXPx: number,
  viewportWidth: number,
  intensity: number
): number {
  const fullRange = 2 * intensity
  const step = (deltaXPx / Math.max(viewportWidth, 1)) * fullRange * TOUCH_LOOK_SENSITIVITY
  const next = currentLookX + step
  return Math.min(intensity, Math.max(-intensity, next))
}
