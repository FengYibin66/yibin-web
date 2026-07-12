import { act, renderHook } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PUBLICATION_CARD_MOTION,
} from '@/components/rooms/publications/publicationConstants'
import { usePublicationCardMotion } from '@/components/rooms/publications/usePublicationCardMotion'

interface TimelineVars {
  onComplete?: () => void
  onInterrupt?: () => void
}

interface TimelineStep {
  target: object
  vars: Record<string, unknown>
  position?: string | number
}

interface TimelineCall {
  vars: TimelineVars
  steps: TimelineStep[]
  kill: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  timelines: [] as TimelineCall[],
  timeline: vi.fn(),
  camera: null as THREE.PerspectiveCamera | null,
}))

vi.mock('gsap', () => ({
  default: {
    timeline: mocks.timeline,
  },
}))

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mocks.camera }),
}))

function createTimeline(vars: TimelineVars): TimelineCall & {
  to: (
    target: object,
    tweenVars: Record<string, unknown>,
    position?: string | number,
  ) => unknown
} {
  const call: TimelineCall = {
    vars,
    steps: [],
    kill: vi.fn(),
  }
  const timeline = {
    ...call,
    to: (
      target: object,
      tweenVars: Record<string, unknown>,
      position?: string | number,
    ) => {
      call.steps.push({ target, vars: tweenVars, position })
      return timeline
    },
  }
  mocks.timelines.push(call)
  return timeline
}

function attachRefs(
  api: ReturnType<typeof usePublicationCardMotion>,
  slotPosition = new THREE.Vector3(0, 1.8, -3),
): {
  paper: THREE.Group
  material: {
    bend: number
    windStrength: number
    uProgress: number
    material: null
  }
} {
  const clothesline = new THREE.Group()
  const slot = new THREE.Group()
  slot.position.copy(slotPosition)
  clothesline.add(slot)
  const card = new THREE.Group()
  slot.add(card)
  const paper = new THREE.Group()
  paper.position.set(0, PUBLICATION_CARD_MOTION.open.hangY, 0)
  card.add(paper)
  clothesline.updateMatrixWorld(true)

  const material = {
    bend: 0,
    windStrength: 0.02,
    uProgress: 0,
    material: null,
  }
  api.paperRef.current = paper
  api.materialRef.current = material
  return { paper, material }
}

function completeTimeline(call: TimelineCall): void {
  act(() => {
    call.vars.onComplete?.()
  })
}

function paperSteps(call: TimelineCall): TimelineStep[] {
  // First step is the camera-frame slerp proxy.
  return call.steps.slice(1)
}

beforeEach(() => {
  mocks.timelines.length = 0
  mocks.timeline.mockReset()
  mocks.timeline.mockImplementation(createTimeline)
  mocks.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400)
  mocks.camera.position.set(-5.7, 0.2, -26)
  mocks.camera.quaternion.identity()
  mocks.camera.lookAt(-11, 1.5, -26)
})

describe('usePublicationCardMotion open (itom clothesline present)', () => {
  it('frames camera then detaches / mid-flips / presents at anchor - slot', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    const { paper, material } = attachRefs(result.current)
    const promise = result.current.open()
    const call = mocks.timelines[0]
    const open = PUBLICATION_CARD_MOTION.open
    const present = {
      x: open.presentAnchor.x - 0,
      y: open.presentAnchor.y - 1.8,
      z: open.presentAnchor.z - (-3),
    }

    expect(call.steps[0]).toMatchObject({
      vars: {
        t: 1,
        duration: PUBLICATION_CARD_MOTION.cameraFrame.duration,
      },
      position: 0,
    })

    const steps = paperSteps(call)

    // detach
    expect(steps[0]).toMatchObject({
      target: paper.position,
      vars: { y: open.hangY - open.detachY },
    })
    expect(steps[1]).toMatchObject({
      target: paper.rotation,
      vars: { x: open.detachRotX, z: open.detachRotZ },
    })
    expect(steps[2]).toMatchObject({
      target: material,
      vars: { bend: open.detachBend, uProgress: 1 },
    })

    // mid
    expect(steps[3]).toMatchObject({
      target: paper.position,
      vars: {
        y: open.hangY + 1.5,
        x: present.x * open.midAnchorMix,
        z: present.z * open.midAnchorMix,
      },
    })
    expect(steps[4]).toMatchObject({
      target: paper.rotation,
      vars: { x: open.midRotX },
    })

    // present
    expect(steps[6]).toMatchObject({
      target: paper.position,
      vars: { x: present.x, y: present.y, z: present.z },
    })
    expect(steps[7]).toMatchObject({
      target: paper.rotation,
      vars: { x: Math.PI, y: 0, z: 0 },
    })
    expect(steps[9]).toMatchObject({
      target: paper.scale,
      vars: { x: open.scale, y: open.scale, z: open.scale },
    })

    completeTimeline(call)
    await promise
  })
})

describe('usePublicationCardMotion close', () => {
  it('returns to hang pose and restores camera frame', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    attachRefs(result.current)
    const openPromise = result.current.open()
    completeTimeline(mocks.timelines[0])
    await openPromise

    const closePromise = result.current.close()
    const call = mocks.timelines[1]
    expect(call.steps[0]).toMatchObject({
      vars: {
        t: 1,
        duration: PUBLICATION_CARD_MOTION.cameraFrame.duration,
      },
      position: 0,
    })
    expect(call.steps.some(step => (
      step.target
      && 'y' in (step.vars)
      && step.vars.y === PUBLICATION_CARD_MOTION.open.hangY
    ))).toBe(true)
    completeTimeline(call)
    await closePromise
  })
})
