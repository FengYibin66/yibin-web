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

export function wrapDisplayOffset(
  rawOffset: number,
  totalWidth: number,
): number {
  assertFinite(rawOffset, 'rawOffset')
  assertPositive(totalWidth, 'totalWidth')

  const halfWidth = totalWidth / 2
  return (
    (((rawOffset + halfWidth) % totalWidth) + totalWidth) % totalWidth -
    halfWidth
  )
}

export function getNearestCarouselTarget(
  current: number,
  targetIndex: number,
  itemGap: number,
  itemCount: number,
): number {
  assertFinite(current, 'current')
  assertFinite(targetIndex, 'targetIndex')
  assertPositive(itemGap, 'itemGap')
  assertPositive(itemCount, 'itemCount')

  const totalWidth = itemGap * itemCount
  assertFinite(totalWidth, 'totalWidth')

  const target = targetIndex * itemGap
  assertFinite(target, 'target')

  return current + wrapDisplayOffset(target - current, totalWidth)
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
