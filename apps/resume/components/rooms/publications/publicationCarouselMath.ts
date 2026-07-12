import { PUBLICATION_CAROUSEL_MAX_DELTA_ULPS } from './publicationConstants'

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`)
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name)
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`)
  }
}

function assertInteger(value: number, name: string): void {
  assertFinite(value, name)
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer`)
  }
}

function normalizeIndex(
  value: number,
  itemCount: number,
): number {
  const remainder = value % itemCount
  const normalized = remainder < 0 ? remainder + itemCount : remainder
  assertFinite(normalized, 'normalizedIndex')
  return normalized
}

function getCenteredModulo(
  value: number,
  totalWidth: number,
): number {
  const remainder = value % totalWidth
  assertFinite(remainder, 'remainder')
  if (remainder === 0) {
    return 0
  }

  const halfWidth = totalWidth / 2
  let centered = remainder
  if (remainder >= halfWidth) {
    centered = remainder - totalWidth
  } else if (remainder < -halfWidth) {
    centered = remainder + totalWidth
  }

  assertFinite(centered, 'centeredOffset')
  return centered
}

function assertDeltaPreserved(
  current: number,
  nearestTarget: number,
  expectedDelta: number,
): void {
  const appliedDelta = nearestTarget - current
  assertFinite(appliedDelta, 'appliedDelta')
  if (expectedDelta !== 0 && appliedDelta === 0) {
    throw new RangeError(
      `nearestTarget cannot represent delta ${expectedDelta} from current ${current}`,
    )
  }

  const tolerance = Math.max(
    Number.MIN_VALUE,
    Math.abs(expectedDelta) *
      Number.EPSILON *
      PUBLICATION_CAROUSEL_MAX_DELTA_ULPS,
  )
  const error = Math.abs(appliedDelta - expectedDelta)
  if (!Number.isFinite(error) || error > tolerance) {
    throw new RangeError(
      `appliedDelta ${appliedDelta} differs from expected delta ${expectedDelta}`,
    )
  }
}

export function wrapDisplayOffset(
  rawOffset: number,
  totalWidth: number,
): number {
  assertFinite(rawOffset, 'rawOffset')
  assertPositive(totalWidth, 'totalWidth')

  return getCenteredModulo(rawOffset, totalWidth)
}

export function getNearestCarouselTarget(
  current: number,
  targetIndex: number,
  itemGap: number,
  itemCount: number,
): number {
  assertFinite(current, 'current')
  assertInteger(targetIndex, 'targetIndex')
  assertPositive(itemGap, 'itemGap')
  assertInteger(itemCount, 'itemCount')
  assertPositive(itemCount, 'itemCount')

  const totalWidth = itemGap * itemCount
  assertPositive(totalWidth, 'totalWidth')

  const normalizedIndex = normalizeIndex(targetIndex, itemCount)
  const target = normalizedIndex * itemGap
  assertFinite(target, 'target')

  const currentInCycle = wrapDisplayOffset(current, totalWidth)
  const targetInCycle = wrapDisplayOffset(target, totalWidth)
  const cycleDifference = targetInCycle - currentInCycle
  assertFinite(cycleDifference, 'cycleDifference')

  const delta = wrapDisplayOffset(cycleDifference, totalWidth)
  const nearestTarget = current + delta
  assertFinite(nearestTarget, 'nearestTarget')
  assertDeltaPreserved(current, nearestTarget, delta)
  return nearestTarget
}

export function applyCarouselDelta(
  currentTarget: number,
  delta: number,
  sensitivity: number,
): number {
  assertFinite(currentTarget, 'currentTarget')
  assertFinite(delta, 'delta')
  assertFinite(sensitivity, 'sensitivity')

  const nextTarget = currentTarget + delta * sensitivity
  assertFinite(nextTarget, 'nextTarget')
  return nextTarget
}
