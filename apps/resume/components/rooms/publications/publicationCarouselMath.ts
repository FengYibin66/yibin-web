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

function normalizeToPeriod(
  value: number,
  totalWidth: number,
  name: string,
): number {
  const remainder = value % totalWidth
  const normalized = remainder < 0 ? remainder + totalWidth : remainder
  assertFinite(normalized, name)
  return normalized
}

function centerNormalizedOffset(
  normalizedOffset: number,
  totalWidth: number,
): number {
  if (normalizedOffset === 0) {
    return 0
  }

  const halfWidth = totalWidth / 2
  if (normalizedOffset < halfWidth) {
    return normalizedOffset
  }

  const centered = normalizedOffset - totalWidth
  assertFinite(centered, 'centeredOffset')
  return centered
}

export function wrapDisplayOffset(
  rawOffset: number,
  totalWidth: number,
): number {
  assertFinite(rawOffset, 'rawOffset')
  assertPositive(totalWidth, 'totalWidth')

  return centerNormalizedOffset(
    normalizeToPeriod(rawOffset, totalWidth, 'normalizedOffset'),
    totalWidth,
  )
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

  const normalizedIndex = normalizeToPeriod(
    targetIndex,
    itemCount,
    'normalizedIndex',
  )
  const target = normalizedIndex * itemGap
  assertFinite(target, 'target')

  const currentInCycle = normalizeToPeriod(
    current,
    totalWidth,
    'currentInCycle',
  )
  const targetInCycle = normalizeToPeriod(
    target,
    totalWidth,
    'targetInCycle',
  )
  const cycleDifference = targetInCycle - currentInCycle
  assertFinite(cycleDifference, 'cycleDifference')

  const delta = wrapDisplayOffset(cycleDifference, totalWidth)
  const nearestTarget = current + delta
  assertFinite(nearestTarget, 'nearestTarget')
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
