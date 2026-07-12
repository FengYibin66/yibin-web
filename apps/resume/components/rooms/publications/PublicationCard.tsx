'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
} from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import PaperMaterial from '../gallery/PaperMaterial'
import { PublicationCardBack } from './PublicationCardBack'
import { PublicationCardFront } from './PublicationCardFront'
import type { PublicationRoomItem } from './publicationTypes'
import { usePublicationCardMotion } from './usePublicationCardMotion'

function fmt3(v: THREE.Vector3 | number[]): string {
  const a = Array.isArray(v) ? v : v.toArray()
  return `[${a.map(n => n.toFixed(3)).join(', ')}]`
}

function summarizeFace(face: THREE.Group | null, label: string) {
  const contentRoot = face?.children[0]
  if (!contentRoot) {
    return { label, missing: true }
  }
  return {
    label,
    rootRotX: contentRoot.rotation.x.toFixed(3),
    children: contentRoot.children.slice(0, 4).map(child => ({
      name: child.name || child.type,
      pos: fmt3(child.position),
      rotX: child.rotation.x.toFixed(3),
    })),
  }
}

const CARD_WIDTH = 1.5
const CARD_HEIGHT = 2
const CARD_SEGMENTS = 16
const PAPER_HANG_Y = -1.1
const CLOTHESPIN_TEXTURE_PATH = '/textures/gallery/klamerka.webp'
const PAPER_BACK_TEXTURE_PATH = '/textures/gallery/tylkartki.webp'
const SURFACE_BASE_WIND = 0.02
const WIND_TIME_FREQUENCY = 2
const WIND_Y_FREQUENCY = 2
const BEND_WIND_MULTIPLIER = 3
const SURFACE_BASE_Z_KEY = 'publicationSurfaceBaseZ'
const SURFACE_BASE_ROTATION_X_KEY = 'publicationSurfaceBaseRotationX'
const CURSOR_HOVER_OWNERS = new Set<object>()

export interface PublicationCardProps {
  publication: PublicationRoomItem
  index: number
  displayPosition: THREE.Vector3
  isSelected: boolean
  isLocked: boolean
  canHover: boolean
  didDragRef: MutableRefObject<boolean>
  onSelect: (id: string) => void
}

export interface PublicationCardHandle {
  open: () => Promise<void>
  close: () => Promise<void>
  cancel: (restoreSnapshot?: boolean) => void
}

export interface PaperSurfaceTransform {
  z: number
  rotationX: number
}

export type PublicationCardFace = 'front' | 'back'

/**
 * Mirrors PaperMaterial's vertex displacement and returns its local tangent.
 */
export function getPaperSurfaceTransform(
  y: number,
  bend: number,
  wind: number,
  time: number,
): PaperSurfaceTransform {
  const phase = time * WIND_TIME_FREQUENCY + y * WIND_Y_FREQUENCY
  const flutterStrength = (
    SURFACE_BASE_WIND + wind
  ) * (1 + Math.abs(bend * BEND_WIND_MULTIPLIER))
  const z = y ** 2 * bend + Math.sin(phase) * flutterStrength
  const slope = (
    2 * y * bend
    + Math.cos(phase) * WIND_Y_FREQUENCY * flutterStrength
  )

  return {
    z,
    rotationX: Math.atan(slope),
  }
}

function getSurfaceBase(
  object: THREE.Object3D,
  key: string,
  currentValue: number,
): number {
  if (object.userData[key] === undefined) {
    object.userData[key] = currentValue
  }
  return object.userData[key] as number
}

export function bindFaceToPaperSurface(
  face: THREE.Group | null,
  side: PublicationCardFace,
  bend: number,
  wind: number,
  time: number,
): void {
  const contentRoot = face?.children[0]
  if (!contentRoot) {
    return
  }

  contentRoot.children.forEach(child => {
    const surfaceY = side === 'back' ? -child.position.y : child.position.y
    const zDirection = side === 'back' ? -1 : 1
    const baseZ = getSurfaceBase(child, SURFACE_BASE_Z_KEY, child.position.z)
    const baseRotationX = getSurfaceBase(
      child,
      SURFACE_BASE_ROTATION_X_KEY,
      child.rotation.x,
    )
    const transform = getPaperSurfaceTransform(
      surfaceY,
      bend,
      wind,
      time,
    )
    child.position.z = baseZ + zDirection * transform.z
    child.rotation.x = baseRotationX + transform.rotationX
  })
}

function isTouchPointer(event: ThreeEvent<PointerEvent>): boolean {
  return event.pointerType === 'touch'
}

function addCursorHoverOwner(owner: object): void {
  CURSOR_HOVER_OWNERS.add(owner)
  document.body.style.cursor = 'pointer'
}

function removeCursorHoverOwner(owner: object): void {
  CURSOR_HOVER_OWNERS.delete(owner)
  document.body.style.cursor = CURSOR_HOVER_OWNERS.size > 0 ? 'pointer' : 'auto'
}

export const PublicationCard = forwardRef<
  PublicationCardHandle,
  PublicationCardProps
>(function PublicationCard({
    publication,
    index,
    displayPosition,
    isSelected,
    isLocked,
    canHover,
    didDragRef,
    onSelect,
  }, ref) {
  const clothespinTexture = useTexture(CLOTHESPIN_TEXTURE_PATH)
  const paperBackTexture = useTexture(PAPER_BACK_TEXTURE_PATH)
  const frontRef = useRef<THREE.Group>(null)
  const backRef = useRef<THREE.Group>(null)
  const hoveredRef = useRef(false)
  const cursorOwnerRef = useRef<object>({})
  const visibilityDumpDoneRef = useRef(false)
  const motion = usePublicationCardMotion()

  useEffect(() => {
    clothespinTexture.colorSpace = THREE.SRGBColorSpace
    paperBackTexture.colorSpace = THREE.SRGBColorSpace
  }, [clothespinTexture, paperBackTexture])

  useImperativeHandle(ref, () => ({
    open: motion.open,
    close: motion.close,
    cancel: motion.cancel,
  }), [motion.cancel, motion.close, motion.open])

  useEffect(() => {
    const shouldReveal = canHover && hoveredRef.current
    if (!isSelected && !isLocked && motion.materialRef.current) {
      motion.materialRef.current.uProgress = shouldReveal ? 1 : 0
    }
    if (shouldReveal && !isSelected && !isLocked) {
      addCursorHoverOwner(cursorOwnerRef.current)
    } else {
      removeCursorHoverOwner(cursorOwnerRef.current)
    }
    return () => {
      removeCursorHoverOwner(cursorOwnerRef.current)
    }
  }, [canHover, isLocked, isSelected, motion.materialRef])

  useFrame(state => {
    const material = motion.materialRef.current
    const paper = motion.paperRef.current
    if (!material || !paper) {
      return
    }
    const time = state.clock.getElapsedTime()
    bindFaceToPaperSurface(
      frontRef.current,
      'front',
      material.bend,
      material.windStrength,
      time,
    )
    bindFaceToPaperSurface(
      backRef.current,
      'back',
      material.bend,
      material.windStrength,
      time,
    )

    // Dump once after present pose (rotation.x ≈ π, z pushed toward camera).
    const nearOpenPose = (
      isSelected
      && Math.abs(paper.rotation.x - Math.PI) < 0.2
      && Math.abs(paper.position.z) > 1
    )
    if (!isSelected) {
      visibilityDumpDoneRef.current = false
    } else if (nearOpenPose && !visibilityDumpDoneRef.current) {
      visibilityDumpDoneRef.current = true
      paper.updateWorldMatrix(true, true)
      const worldPos = new THREE.Vector3()
      paper.getWorldPosition(worldPos)
      const slot = paper.parent?.parent
      const slotWorld = new THREE.Vector3()
      slot?.getWorldPosition(slotWorld)
      const cam = state.camera.position.clone()
      const toPaper = worldPos.clone().sub(cam)
      const camForward = new THREE.Vector3()
      state.camera.getWorldDirection(camForward)
      const mesh = paper.children.find(
        (child): child is THREE.Mesh => child instanceof THREE.Mesh,
      )
      const ndc = worldPos.clone().project(state.camera)
      const inFront = toPaper.dot(camForward)
      const inFrustum = (
        Math.abs(ndc.x) <= 1.2
        && Math.abs(ndc.y) <= 1.2
        && ndc.z >= -1
        && ndc.z <= 1
      )
      // Flat lines so DevTools can't collapse the critical fields.
      console.log('[pub-debug] VISIBILITY id=', publication.id)
      console.log('[pub-debug] VISIBILITY localPos=', fmt3(paper.position))
      console.log('[pub-debug] VISIBILITY worldPos=', fmt3(worldPos))
      console.log('[pub-debug] VISIBILITY slotWorld=', fmt3(slotWorld))
      console.log('[pub-debug] VISIBILITY cameraPos=', fmt3(cam))
      console.log('[pub-debug] VISIBILITY camForward=', fmt3(camForward))
      console.log('[pub-debug] VISIBILITY distToCam=', toPaper.length().toFixed(3))
      console.log('[pub-debug] VISIBILITY inFrontOfCam=', inFront.toFixed(3), inFront > 0 ? 'OK' : 'BEHIND')
      console.log('[pub-debug] VISIBILITY ndc=', fmt3(ndc))
      console.log('[pub-debug] VISIBILITY inNdcFrustum=', inFrustum)
      console.log('[pub-debug] VISIBILITY meshVisible=', mesh?.visible)
      console.log('[pub-debug] VISIBILITY mat=', (mesh?.material as THREE.Material | undefined)?.type, 'opacity=', (mesh?.material as THREE.Material | undefined)?.opacity)
      console.log('[pub-debug] VISIBILITY bend/uProgress=', material.bend, material.uProgress)
      console.log('[pub-debug] VISIBILITY front=', JSON.stringify(summarizeFace(frontRef.current, 'front')))
      console.log('[pub-debug] VISIBILITY back=', JSON.stringify(summarizeFace(backRef.current, 'back')))
    }
  })

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    if (isLocked || didDragRef.current) {
      console.warn('[pub-debug] card click blocked', {
        id: publication.id,
        isLocked,
        didDrag: didDragRef.current,
      })
      return
    }
    console.log('[pub-debug] card click', publication.id)
    onSelect(publication.id)
  }, [didDragRef, isLocked, onSelect, publication.id])

  const handlePointerOver = useCallback((
    event: ThreeEvent<PointerEvent>,
  ): void => {
    event.stopPropagation()
    if (isTouchPointer(event)) {
      return
    }
    hoveredRef.current = true
    if (!canHover || isSelected || isLocked) {
      return
    }
    if (motion.materialRef.current) {
      motion.materialRef.current.uProgress = 1
    }
    addCursorHoverOwner(cursorOwnerRef.current)
  }, [canHover, isLocked, isSelected, motion.materialRef])

  const handlePointerOut = useCallback((
    event: ThreeEvent<PointerEvent>,
  ): void => {
    hoveredRef.current = false
    removeCursorHoverOwner(cursorOwnerRef.current)
    if (isTouchPointer(event) || isSelected || isLocked) {
      return
    }
    if (motion.materialRef.current) {
      motion.materialRef.current.uProgress = 0
    }
  }, [isLocked, isSelected, motion.materialRef])

  return (
    <group
      name={`publication-card-${index}`}
      position={displayPosition}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh position={[0, -0.08, 0.15]} rotation={[0, 0, Math.PI]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial
          color="#ffffff"
          map={clothespinTexture}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={motion.paperRef} position={[0, PAPER_HANG_Y, 0]}>
        {/* itom: paper mesh always raycasts; OPEN hit-area stopPropagates above it */}
        <mesh>
          <planeGeometry
            args={[CARD_WIDTH, CARD_HEIGHT, CARD_SEGMENTS, CARD_SEGMENTS]}
          />
          <PaperMaterial
            ref={motion.materialRef}
            color="#ffffff"
            map={paperBackTexture}
            mapBack={paperBackTexture}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Preview: Title → Image → Venue · Year */}
        <group ref={frontRef} visible={!isSelected}>
          <PublicationCardFront publication={publication} opacity={1} />
        </group>
        <group ref={backRef}>
          <PublicationCardBack
            publication={publication}
            opacity={1}
            isOpen={isSelected && !isLocked}
          />
        </group>
      </group>
    </group>
  )
})
