'use client'

import { useCallback, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import PaperMaterial from '../gallery/PaperMaterial'
import { PublicationCardBack } from './PublicationCardBack'
import { PublicationCardFront } from './PublicationCardFront'
import type { PublicationRoomItem } from './publicationTypes'
import { usePublicationCardMotion } from './usePublicationCardMotion'

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

export interface PublicationCardProps {
  publication: PublicationRoomItem
  index: number
  displayPosition: THREE.Vector3
  isSelected: boolean
  isLocked: boolean
  canHover: boolean
  onSelect: (id: string) => void
}

export interface PaperSurfaceTransform {
  z: number
  rotationX: number
}

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

function bindFaceToPaperSurface(
  face: THREE.Group | null,
  bend: number,
  wind: number,
  time: number,
): void {
  const contentRoot = face?.children[0]
  if (!contentRoot) {
    return
  }

  contentRoot.children.forEach(child => {
    const baseZ = getSurfaceBase(child, SURFACE_BASE_Z_KEY, child.position.z)
    const baseRotationX = getSurfaceBase(
      child,
      SURFACE_BASE_ROTATION_X_KEY,
      child.rotation.x,
    )
    const transform = getPaperSurfaceTransform(
      child.position.y,
      bend,
      wind,
      time,
    )
    child.position.z = baseZ + transform.z
    child.rotation.x = baseRotationX + transform.rotationX
  })
}

function isTouchPointer(event: ThreeEvent<PointerEvent>): boolean {
  return event.pointerType === 'touch'
}

export function PublicationCard({
  publication,
  index,
  displayPosition,
  isSelected,
  isLocked,
  canHover,
  onSelect,
}: PublicationCardProps) {
  const clothespinTexture = useTexture(CLOTHESPIN_TEXTURE_PATH)
  const paperBackTexture = useTexture(PAPER_BACK_TEXTURE_PATH)
  const frontRef = useRef<THREE.Group>(null)
  const backRef = useRef<THREE.Group>(null)
  const motion = usePublicationCardMotion()

  useFrame(state => {
    const material = motion.materialRef.current
    if (!material) {
      return
    }
    const time = state.clock.getElapsedTime()
    bindFaceToPaperSurface(
      frontRef.current,
      material.bend,
      material.windStrength,
      time,
    )
    bindFaceToPaperSurface(
      backRef.current,
      material.bend,
      material.windStrength,
      time,
    )
  })

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    if (isSelected || isLocked) {
      return
    }
    onSelect(publication.id)
  }, [isLocked, isSelected, onSelect, publication.id])

  const handlePointerOver = useCallback((
    event: ThreeEvent<PointerEvent>,
  ): void => {
    event.stopPropagation()
    if (!canHover || isTouchPointer(event)) {
      return
    }
    if (motion.materialRef.current) {
      motion.materialRef.current.uProgress = 1
    }
    document.body.style.cursor = 'pointer'
  }, [canHover, motion.materialRef])

  const handlePointerOut = useCallback((
    event: ThreeEvent<PointerEvent>,
  ): void => {
    if (!canHover || isTouchPointer(event)) {
      return
    }
    if (motion.materialRef.current) {
      motion.materialRef.current.uProgress = 0
    }
    document.body.style.cursor = 'auto'
  }, [canHover, motion.materialRef])

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
        <mesh>
          <planeGeometry
            args={[CARD_WIDTH, CARD_HEIGHT, CARD_SEGMENTS, CARD_SEGMENTS]}
          />
          <PaperMaterial
            ref={motion.materialRef}
            color="#ffffff"
            mapBack={paperBackTexture}
            side={THREE.DoubleSide}
          />
        </mesh>

        <group ref={frontRef}>
          <PublicationCardFront publication={publication} opacity={1} />
        </group>
        <group ref={backRef}>
          <PublicationCardBack
            publication={publication}
            opacity={1}
            isOpen={isSelected}
          />
        </group>
      </group>
    </group>
  )
}
