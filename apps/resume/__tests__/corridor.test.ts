import { describe, it, expect } from 'vitest'

// ─── Pure functions extracted from CorridorSegment.tsx ───────────────────────

const SEGMENT_LENGTH = 100

function segmentZStart(index: number): number {
  return 10 - index * SEGMENT_LENGTH
}

function cameraZToSegmentIndex(cameraZ: number): number {
  return Math.floor((10 - cameraZ) / SEGMENT_LENGTH)
}

describe('segmentZStart', () => {
  it('segment 0 starts at Z=10', () => {
    expect(segmentZStart(0)).toBe(10)
  })

  it('segment 1 starts at Z=-90', () => {
    expect(segmentZStart(1)).toBe(-90)
  })

  it('segment 2 starts at Z=-190', () => {
    expect(segmentZStart(2)).toBe(-190)
  })

  it('negative segment -1 starts at Z=110 (backward corridor)', () => {
    expect(segmentZStart(-1)).toBe(110)
  })

  it('negative segment -2 starts at Z=210', () => {
    expect(segmentZStart(-2)).toBe(210)
  })
})

describe('cameraZToSegmentIndex', () => {
  it('camera at Z=10 is segment 0', () => {
    expect(cameraZToSegmentIndex(10)).toBe(0)
  })

  it('camera at Z=28 (initial position) is segment -1 (before segment 0 start at Z=10)', () => {
    // segment 0 spans Z=10 to Z=-90; Z=28 is behind the start, so segment -1
    expect(cameraZToSegmentIndex(28)).toBe(-1)
  })

  it('camera at Z=-90 is segment 1', () => {
    expect(cameraZToSegmentIndex(-90)).toBe(1)
  })

  it('camera at Z=-100 is segment 1 (just past boundary)', () => {
    expect(cameraZToSegmentIndex(-100)).toBe(1)
  })

  it('camera at Z=-190 is segment 2', () => {
    expect(cameraZToSegmentIndex(-190)).toBe(2)
  })

  it('camera at Z=110 is segment -1 (backward)', () => {
    expect(cameraZToSegmentIndex(110)).toBe(-1)
  })

  it('camera at Z=200 is segment -2', () => {
    expect(cameraZToSegmentIndex(200)).toBe(-2)
  })
})

// ─── segmentIndex fix: teleport selects nearest segment ──────────────────────

describe('teleport door segment selection', () => {
  function shouldDoorRespond(doorSegmentIndex: number, cameraZ: number): boolean {
    const currentSeg = Math.floor((10 - cameraZ) / SEGMENT_LENGTH)
    return doorSegmentIndex === currentSeg
  }

  it('door in segment -1 responds when camera is at Z=28 (initial position)', () => {
    // Z=28 → segment -1 (before the start of seg 0 at Z=10)
    expect(shouldDoorRespond(-1, 28)).toBe(true)
  })

  it('door in segment 0 does NOT respond when camera is at Z=28', () => {
    expect(shouldDoorRespond(0, 28)).toBe(false)
  })

  it('door in segment 0 responds when camera is at Z=5 (inside seg 0)', () => {
    expect(shouldDoorRespond(0, 5)).toBe(true)
  })

  it('door in segment 0 does NOT respond when camera is at Z=-90 (seg 1)', () => {
    expect(shouldDoorRespond(0, -90)).toBe(false)
  })

  it('door in segment 1 responds when camera is at Z=-90', () => {
    expect(shouldDoorRespond(1, -90)).toBe(true)
  })

  it('door in segment 1 does NOT respond when camera is at Z=5 (seg 0)', () => {
    expect(shouldDoorRespond(1, 5)).toBe(false)
  })

  it('backward corridor: door in segment -1 responds at Z=28 (initial)', () => {
    expect(shouldDoorRespond(-1, 28)).toBe(true)
  })

  it('backward corridor: door in segment -2 responds at Z=110', () => {
    // Z=110 → floor((10-110)/100) = floor(-1) = -1, so seg -1 not -2
    expect(shouldDoorRespond(-1, 110)).toBe(true)
  })
})

// ─── InfiniteCorridorManager active segments ─────────────────────────────────

describe('InfiniteCorridorManager active segments', () => {
  function getActiveSegments(cameraZ: number): [number, number, number] {
    const current = Math.floor((10 - cameraZ) / SEGMENT_LENGTH)
    return [current - 1, current, current + 1]
  }

  it('at Z=28, mounts segments [-2, -1, 0] (initial position is in seg -1)', () => {
    // Z=28 → seg -1, so active = [-2, -1, 0]
    expect(getActiveSegments(28)).toEqual([-2, -1, 0])
  })

  it('at Z=-90, mounts segments [0, 1, 2]', () => {
    expect(getActiveSegments(-90)).toEqual([0, 1, 2])
  })

  it('at Z=-190, mounts segments [1, 2, 3]', () => {
    expect(getActiveSegments(-190)).toEqual([1, 2, 3])
  })

  it('at Z=110 (backward), mounts segments [-2, -1, 0]', () => {
    expect(getActiveSegments(110)).toEqual([-2, -1, 0])
  })
})
