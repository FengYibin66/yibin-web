import * as THREE from 'three'
import { PUBLICATION_CARD_MOTION } from './publicationConstants'

/**
 * itom Gallery ProjectCard present anchor, in clothesline-group local space.
 * Opened paper world (within clothesline) = this anchor, so z=+1.5 sits in
 * front of the railing (railing ≈ z=-3.9 in balcony space).
 */
export function resolvePresentLocalTarget(paper: THREE.Group): THREE.Vector3 {
  const anchor = PUBLICATION_CARD_MOTION.open.presentAnchor
  // paper → card → clothesline-item (slot on the rope)
  const slot = paper.parent?.parent
  const slotPos = slot?.position ?? new THREE.Vector3()
  return new THREE.Vector3(
    anchor.x - slotPos.x,
    anchor.y - slotPos.y,
    anchor.z - slotPos.z,
  )
}

/** Present point in world space (card-local target through the card parent). */
export function resolvePresentWorldTarget(paper: THREE.Group): THREE.Vector3 {
  const local = resolvePresentLocalTarget(paper)
  const card = paper.parent
  if (!card) return local
  card.updateWorldMatrix(true, false)
  return card.localToWorld(local)
}

/** Object-local +Z expressed as a world-space unit vector. */
export function resolveLocalPlusZWorld(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false)
  const origin = new THREE.Vector3()
  const plusZ = new THREE.Vector3(0, 0, 1)
  object.localToWorld(origin)
  object.localToWorld(plusZ)
  return plusZ.sub(origin).normalize()
}

/**
 * Clothesline-local +Z in world space — the direction the paper face points
 * toward the door / reading side after open (rot.x = π shows the back that way).
 */
export function resolveClotheslineFacingWorld(paper: THREE.Group): THREE.Vector3 {
  // paper → card → slot → clothesline group
  const clothesline = paper.parent?.parent?.parent
  if (!clothesline) return new THREE.Vector3(0, 0, 1)
  return resolveLocalPlusZWorld(clothesline)
}

export interface ReadingCameraPose {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

function poseLookingAt(
  camera: THREE.Object3D,
  position: THREE.Vector3,
  target: THREE.Vector3,
): ReadingCameraPose {
  const savedPos = camera.position.clone()
  const savedQuat = camera.quaternion.clone()
  camera.position.copy(position)
  camera.lookAt(target)
  const quaternion = camera.quaternion.clone()
  camera.position.copy(savedPos)
  camera.quaternion.copy(savedQuat)
  return { position: position.clone(), quaternion }
}

/**
 * Camera pose that stands on the paper's facing axis (itom's implied geometry).
 * lookAt alone from an off-axis entry position foreshortens the paper edge-on.
 */
export function resolveReadingCameraPose(
  paper: THREE.Group,
  camera: THREE.Object3D,
  readingDistance = PUBLICATION_CARD_MOTION.cameraFrame.readingDistance,
): ReadingCameraPose {
  const presentWorld = resolvePresentWorldTarget(paper)
  const facing = resolveClotheslineFacingWorld(paper)
  const position = presentWorld.clone().addScaledVector(facing, readingDistance)
  return poseLookingAt(camera, position, presentWorld)
}

/**
 * Post-entry hang view: stand on clothesline +Z looking at the rope center so
 * hanging cards sit in the middle of the viewport (corridor fly-in is off-axis).
 */
export function resolveBrowseCameraPose(
  clothesline: THREE.Object3D,
  camera: THREE.Object3D,
  browseDistance = PUBLICATION_CARD_MOTION.cameraFrame.browseDistance,
): ReadingCameraPose {
  const look = PUBLICATION_CARD_MOTION.cameraFrame.browseLookAt
  clothesline.updateWorldMatrix(true, false)
  const target = clothesline.localToWorld(
    new THREE.Vector3(look.x, look.y, look.z),
  )
  const facing = resolveLocalPlusZWorld(clothesline)
  const position = target.clone().addScaledVector(facing, browseDistance)
  return poseLookingAt(camera, position, target)
}
