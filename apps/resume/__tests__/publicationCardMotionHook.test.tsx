import { StrictMode } from 'react'
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
}))

vi.mock('gsap', () => ({
  default: {
    timeline: mocks.timeline,
  },
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
  options: {
    parentPosition?: THREE.Vector3
    position?: THREE.Vector3
    rotation?: THREE.Euler
    scale?: THREE.Vector3
    bend?: number
    windStrength?: number
    uProgress?: number
  } = {},
): {
  paper: THREE.Group
  material: {
    bend: number
    windStrength: number
    uProgress: number
    material: null
  }
} {
  const parent = new THREE.Group()
  parent.position.copy(options.parentPosition ?? new THREE.Vector3())
  const paper = new THREE.Group()
  paper.position.copy(options.position ?? new THREE.Vector3(1, -1.1, 2))
  paper.rotation.copy(options.rotation ?? new THREE.Euler(0.1, 0.2, 0.3))
  paper.scale.copy(options.scale ?? new THREE.Vector3(0.9, 0.8, 0.7))
  parent.add(paper)
  parent.updateMatrixWorld(true)

  const material = {
    bend: options.bend ?? 0.2,
    windStrength: options.windStrength ?? 0.07,
    uProgress: options.uProgress ?? 0.35,
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

beforeEach(() => {
  mocks.timelines.length = 0
  mocks.timeline.mockReset()
  mocks.timeline.mockImplementation(createTimeline)
})

describe('usePublicationCardMotion open sequence', () => {
  it('runs the four high-fidelity stages in order with constants', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    const { paper, material } = attachRefs(result.current)
    const target = new THREE.Vector3(4, 5, 6)

    const promise = result.current.open(target)
    const call = mocks.timelines[0]

    expect(call.steps).toHaveLength(10)
    expect(call.steps[0]).toMatchObject({
      target: paper.position,
      vars: {
        y: -1.1 - PUBLICATION_CARD_MOTION.open.detachY,
        duration: PUBLICATION_CARD_MOTION.open.detachDuration,
        ease: PUBLICATION_CARD_MOTION.open.detachEase,
      },
    })
    expect(call.steps[1]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: {
        x: PUBLICATION_CARD_MOTION.open.detachRotationX,
        z: PUBLICATION_CARD_MOTION.open.detachRotationZ,
      },
    })
    expect(call.steps[2]).toMatchObject({
      target: material,
      position: '<',
      vars: {
        bend: PUBLICATION_CARD_MOTION.open.detachBend,
        windStrength: 0,
        uProgress: 1,
      },
    })
    expect(call.steps[3]).toMatchObject({
      target: paper.position,
      vars: {
        y: -1.1 + PUBLICATION_CARD_MOTION.open.liftY,
        duration: PUBLICATION_CARD_MOTION.open.liftDuration,
        ease: PUBLICATION_CARD_MOTION.open.liftEase,
      },
    })
    expect(call.steps[4]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: { x: Math.PI * PUBLICATION_CARD_MOTION.open.flipRatio },
    })
    expect(call.steps[4].vars).not.toHaveProperty('y')
    expect(call.steps[5]).toMatchObject({
      target: material,
      position: '<',
      vars: { bend: PUBLICATION_CARD_MOTION.open.liftBend },
    })
    expect(call.steps[6]).toMatchObject({
      target: paper.position,
      vars: { x: 4, y: 5, z: 6 },
    })
    expect(call.steps[7]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: { x: Math.PI, y: 0, z: 0 },
    })
    expect(call.steps[8]).toMatchObject({
      target: paper.scale,
      vars: {
        x: PUBLICATION_CARD_MOTION.open.scale,
        y: PUBLICATION_CARD_MOTION.open.scale,
        z: PUBLICATION_CARD_MOTION.open.scale,
      },
    })
    expect(call.steps[9]).toMatchObject({
      target: material,
      position: '<',
      vars: { bend: 0 },
    })

    completeTimeline(call)
    await promise
  })

  it('converts a copied world target to the parent local space', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    attachRefs(result.current, {
      parentPosition: new THREE.Vector3(10, 20, 30),
    })
    const target = new THREE.Vector3(11, 22, 33)

    const promise = result.current.open(target)
    target.set(100, 200, 300)
    const centerStep = mocks.timelines[0].steps[6]

    expect(centerStep.vars).toMatchObject({ x: 1, y: 2, z: 3 })
    completeTimeline(mocks.timelines[0])
    await promise
  })
})

describe('usePublicationCardMotion close sequence', () => {
  it('strictly reverses stages and restores the captured snapshot', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    const snapshot = {
      position: new THREE.Vector3(1, -1.1, 2),
      rotation: new THREE.Euler(0.1, 0.2, 0.3),
      scale: new THREE.Vector3(0.9, 0.8, 0.7),
      bend: 0.2,
      windStrength: 0.07,
      uProgress: 0.35,
    }
    const { paper, material } = attachRefs(result.current, snapshot)
    const openPromise = result.current.open(new THREE.Vector3(4, 5, 6))
    completeTimeline(mocks.timelines[0])
    await openPromise

    const closePromise = result.current.close()
    const call = mocks.timelines[1]

    expect(call.steps).toHaveLength(11)
    expect(call.steps[0]).toMatchObject({
      target: paper.scale,
      vars: {
        x: snapshot.scale.x,
        y: snapshot.scale.y,
        z: snapshot.scale.z,
      },
    })
    expect(call.steps[1]).toMatchObject({
      target: material,
      position: '<',
      vars: { bend: PUBLICATION_CARD_MOTION.open.liftBend },
    })
    expect(call.steps[2]).toMatchObject({
      target: paper.position,
      vars: {
        y: snapshot.position.y + PUBLICATION_CARD_MOTION.open.liftY,
      },
    })
    expect(call.steps[3]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: {
        x: Math.PI * PUBLICATION_CARD_MOTION.open.flipRatio,
        y: snapshot.rotation.y,
        z: PUBLICATION_CARD_MOTION.open.detachRotationZ,
      },
    })
    expect(call.steps[5]).toMatchObject({
      target: paper.position,
      vars: {
        y: snapshot.position.y - PUBLICATION_CARD_MOTION.open.detachY,
      },
    })
    expect(call.steps[6]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: {
        x: PUBLICATION_CARD_MOTION.open.detachRotationX,
        y: snapshot.rotation.y,
        z: PUBLICATION_CARD_MOTION.open.detachRotationZ,
      },
    })
    expect(call.steps[8]).toMatchObject({
      target: paper.position,
      vars: {
        x: snapshot.position.x,
        y: snapshot.position.y,
        z: snapshot.position.z,
      },
    })
    expect(call.steps[9]).toMatchObject({
      target: paper.rotation,
      position: '<',
      vars: {
        x: snapshot.rotation.x,
        y: snapshot.rotation.y,
        z: snapshot.rotation.z,
      },
    })
    expect(call.steps[10]).toMatchObject({
      target: material,
      position: '<',
      vars: {
        bend: snapshot.bend,
        windStrength: snapshot.windStrength,
        uProgress: snapshot.uProgress,
      },
    })

    completeTimeline(call)
    await closePromise
  })

  it('captures a fresh snapshot before every open', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    const { paper, material } = attachRefs(result.current)
    const first = result.current.open(new THREE.Vector3(4, 5, 6))
    completeTimeline(mocks.timelines[0])
    await first

    paper.position.set(7, 8, 9)
    paper.rotation.set(0.4, 0.5, 0.6)
    paper.scale.set(1.2, 1.3, 1.4)
    material.bend = 0.4
    material.windStrength = 0.5
    material.uProgress = 0.6
    const second = result.current.open(new THREE.Vector3())
    completeTimeline(mocks.timelines[1])
    await second
    const close = result.current.close()
    const restorePosition = mocks.timelines[2].steps[8]
    const restoreMaterial = mocks.timelines[2].steps[10]

    expect(restorePosition.vars).toMatchObject({ x: 7, y: 8, z: 9 })
    expect(restoreMaterial.vars).toMatchObject({
      bend: 0.4,
      windStrength: 0.5,
      uProgress: 0.6,
    })
    completeTimeline(mocks.timelines[2])
    await close
  })
})

describe('usePublicationCardMotion lifecycle', () => {
  it('kills and settles an action replaced by a new action', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    attachRefs(result.current)
    let firstSettlements = 0
    const first = result.current.open(new THREE.Vector3()).then(() => {
      firstSettlements += 1
    })
    const firstCall = mocks.timelines[0]
    firstCall.kill.mockImplementation(() => firstCall.vars.onInterrupt?.())

    const second = result.current.close()
    await first
    firstCall.vars.onComplete?.()
    await Promise.resolve()

    expect(firstCall.kill).toHaveBeenCalledOnce()
    expect(firstSettlements).toBe(1)
    completeTimeline(mocks.timelines[1])
    await second
  })

  it('cancel kills and idempotently settles the active promise', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())
    attachRefs(result.current)
    let settlements = 0
    const promise = result.current.open(new THREE.Vector3()).then(() => {
      settlements += 1
    })
    const call = mocks.timelines[0]
    call.kill.mockImplementation(() => call.vars.onInterrupt?.())

    act(() => {
      result.current.cancel()
      result.current.cancel()
    })
    await promise
    call.vars.onComplete?.()
    await Promise.resolve()

    expect(call.kill).toHaveBeenCalledOnce()
    expect(settlements).toBe(1)
  })

  it('kills and settles on unmount', async () => {
    const { result, unmount } = renderHook(() => usePublicationCardMotion())
    attachRefs(result.current)
    const promise = result.current.open(new THREE.Vector3())
    const call = mocks.timelines[0]

    unmount()
    await promise

    expect(call.kill).toHaveBeenCalledOnce()
  })

  it('settles safely without mounted refs or a captured snapshot', async () => {
    const { result } = renderHook(() => usePublicationCardMotion())

    await expect(result.current.open(new THREE.Vector3())).resolves.toBeUndefined()
    await expect(result.current.close()).resolves.toBeUndefined()

    expect(mocks.timeline).not.toHaveBeenCalled()
  })

  it('remains usable through StrictMode effect replay', async () => {
    const { result } = renderHook(() => usePublicationCardMotion(), {
      wrapper: StrictMode,
    })
    attachRefs(result.current)

    const promise = result.current.open(new THREE.Vector3())
    completeTimeline(mocks.timelines[0])

    await promise
    expect(mocks.timeline).toHaveBeenCalledOnce()
  })
})
