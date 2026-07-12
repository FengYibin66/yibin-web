import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PUBLICATION_CARD_MOTION } from '@/components/rooms/publications/publicationConstants'
import {
  resolveBrowseCameraPose,
  resolveClotheslineFacingWorld,
  resolvePresentLocalTarget,
  resolvePresentWorldTarget,
  resolveReadingCameraPose,
} from '@/components/rooms/publications/publicationOpenPose'

function buildPaperHierarchy(slotPosition = new THREE.Vector3(0, 1.8, -3)) {
  const clothesline = new THREE.Group()
  const slot = new THREE.Group()
  slot.position.copy(slotPosition)
  clothesline.add(slot)
  const card = new THREE.Group()
  slot.add(card)
  const paper = new THREE.Group()
  card.add(paper)
  clothesline.updateMatrixWorld(true)
  return { clothesline, slot, card, paper }
}

describe('resolvePresentLocalTarget', () => {
  it('returns clothesline anchor minus the rope slot position (itom formula)', () => {
    const { paper, slot } = buildPaperHierarchy()
    const target = resolvePresentLocalTarget(paper)
    const anchor = PUBLICATION_CARD_MOTION.open.presentAnchor

    expect(target.x).toBeCloseTo(anchor.x - 0)
    expect(target.y).toBeCloseTo(anchor.y - 1.8)
    expect(target.z).toBeCloseTo(anchor.z - (-3))

    expect(slot.position.x + target.x).toBeCloseTo(anchor.x)
    expect(slot.position.y + target.y).toBeCloseTo(anchor.y)
    expect(slot.position.z + target.z).toBeCloseTo(anchor.z)
  })
})

describe('resolvePresentWorldTarget', () => {
  it('maps the clothesline present through the card parent matrix', () => {
    const { paper } = buildPaperHierarchy()
    const world = resolvePresentWorldTarget(paper)
    const anchor = PUBLICATION_CARD_MOTION.open.presentAnchor
    expect(world.x).toBeCloseTo(anchor.x)
    expect(world.y).toBeCloseTo(anchor.y)
    expect(world.z).toBeCloseTo(anchor.z)
  })
})

describe('resolveReadingCameraPose', () => {
  it('stands on clothesline +Z looking at the present point', () => {
    const { paper } = buildPaperHierarchy()
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(-5, 0.2, 0)
    camera.quaternion.identity()

    const facing = resolveClotheslineFacingWorld(paper)
    expect(facing.z).toBeCloseTo(1)

    const present = resolvePresentWorldTarget(paper)
    const pose = resolveReadingCameraPose(paper, camera)
    const dist = PUBLICATION_CARD_MOTION.cameraFrame.readingDistance

    expect(pose.position.x).toBeCloseTo(present.x + facing.x * dist)
    expect(pose.position.y).toBeCloseTo(present.y + facing.y * dist)
    expect(pose.position.z).toBeCloseTo(present.z + facing.z * dist)

    expect(camera.position.x).toBeCloseTo(-5)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
    const toPresent = present.clone().sub(pose.position).normalize()
    expect(forward.dot(toPresent)).toBeGreaterThan(0.99)
  })
})

describe('resolveBrowseCameraPose', () => {
  it('stands on clothesline +Z looking at the browse look-at point', () => {
    const clothesline = new THREE.Group()
    clothesline.updateMatrixWorld(true)
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(-5, 0.2, 0)

    const pose = resolveBrowseCameraPose(clothesline, camera)
    const look = PUBLICATION_CARD_MOTION.cameraFrame.browseLookAt
    const dist = PUBLICATION_CARD_MOTION.cameraFrame.browseDistance

    expect(pose.position.x).toBeCloseTo(look.x)
    expect(pose.position.y).toBeCloseTo(look.y)
    expect(pose.position.z).toBeCloseTo(look.z + dist)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
    const toTarget = new THREE.Vector3(look.x, look.y, look.z)
      .sub(pose.position)
      .normalize()
    expect(forward.dot(toTarget)).toBeGreaterThan(0.99)
  })
})
