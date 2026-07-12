'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  usePerformance,
  type PerformanceTier,
} from '@/context/PerformanceContext'
import { GalleryClouds } from '../gallery/GalleryClouds'
import {
  advancePublicationBird,
  usePublicationCityAmbience,
  type PublicationBirdState,
} from './publicationSceneryRuntime'

export {
  advancePublicationBird,
  type PublicationBirdState,
} from './publicationSceneryRuntime'

const FLOOR_TEXTURE_PATH = '/textures/gallery/floor.webp'
const RAILING_TEXTURE_PATH = '/textures/gallery/railing.webp'
const THRESHOLD_TEXTURE_PATH = '/textures/corridor/texturadoprogow.webp'
const HOUSES_TEXTURE_PATH = '/textures/gallery/domki.webp'
const CITY_TEXTURE_PATH = '/textures/gallery/miastotlo.webp'
const BIRD_TEXTURE_PATH = '/textures/gallery/bird_gray.webp'
const RIGHT_HOUSE_CROP = 0.2
const HOUSES_WIDTH = 15
const HOUSES_HEIGHT = HOUSES_WIDTH / 2.357
const CITY_WIDTH = 30
const CITY_HEIGHT = CITY_WIDTH / 2.357
const RAILING_HEIGHT = 1.25
/** Decorative scenery must not steal pointer hits from hanging cards. */
const disableRaycast: THREE.Mesh['raycast'] = () => undefined

export const PUBLICATION_ROPE_POINTS = [
  new THREE.Vector3(-16, 3.5, -6),
  new THREE.Vector3(-8, 2.5, -4.5),
  new THREE.Vector3(0, 1.8, -3),
  new THREE.Vector3(8, 2.5, -4.5),
  new THREE.Vector3(16, 3.5, -6),
] as const

export interface PublicationsPaintApi {
  opacity: number
  onBeforeCompile?: THREE.Material['onBeforeCompile']
}

export interface PublicationsSceneryProps {
  paint?: PublicationsPaintApi
  ambienceEnabled?: boolean
  children?: ReactNode
}

export function getPublicationCloudCount(tier: PerformanceTier): number {
  return tier === 'LOW' ? 32 : 65
}

export function getRightHouseCrop(baseWidth: number, cropAmount: number) {
  const repeatX = 1 - cropAmount
  const width = baseWidth * repeatX
  return {
    offsetX: cropAmount,
    repeatX,
    width,
    centerX: baseWidth / 2 + width / 2,
  }
}

export function getPublicationsMaterialProps(paint?: PublicationsPaintApi) {
  const opacity = paint?.opacity ?? 1
  return {
    color: '#e0e0e0',
    transparent: opacity < 1,
    opacity,
    onBeforeCompile: paint?.onBeforeCompile,
  }
}

export function createPublicationsFloorMaterial(
  texture: THREE.Texture,
  paint?: PublicationsPaintApi,
): THREE.MeshBasicMaterial {
  const props = getPublicationsMaterialProps(paint)
  const material = new THREE.MeshBasicMaterial({
    color: props.color,
    map: texture,
    opacity: props.opacity,
    side: THREE.DoubleSide,
    transparent: props.transparent,
  })
  if (props.onBeforeCompile) material.onBeforeCompile = props.onBeforeCompile
  return material
}

function FlyingBird({ texture, opacity }: {
  texture: THREE.Texture
  opacity: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const state = useRef<PublicationBirdState>({
    x: -25,
    y: 4.5,
    velocityY: 0,
    jumpTimer: 0,
    rotationZ: 0,
  })

  useFrame((_, delta) => {
    state.current = advancePublicationBird(state.current, delta)
    ref.current?.position.set(state.current.x, state.current.y, -10)
    if (ref.current) ref.current.rotation.z = state.current.rotationZ
  })

  return (
      <mesh ref={ref} name="publication-bird" position={[-25, 4.5, -10]}
      scale={[0.49, 0.35, 1]} raycast={disableRaycast}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial map={texture} color="#e0e0e0" transparent
        opacity={opacity} alphaTest={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function PublicationsScenery({
  paint,
  ambienceEnabled = true,
  children,
}: PublicationsSceneryProps) {
  const { tier } = usePerformance()
  const floorTexture = useTexture(FLOOR_TEXTURE_PATH)
  const railingTexture = useTexture(RAILING_TEXTURE_PATH)
  const thresholdTexture = useTexture(THRESHOLD_TEXTURE_PATH)
  const housesTexture = useTexture(HOUSES_TEXTURE_PATH)
  const cityTexture = useTexture(CITY_TEXTURE_PATH)
  const birdTexture = useTexture(BIRD_TEXTURE_PATH)
  usePublicationCityAmbience(ambienceEnabled)
  const materialProps = getPublicationsMaterialProps(paint)

  useEffect(() => {
    floorTexture.wrapS = floorTexture.wrapT = THREE.MirroredRepeatWrapping
    floorTexture.repeat.set(0.5, 0.5 * 1.835)
    railingTexture.wrapS = railingTexture.wrapT = THREE.RepeatWrapping
    railingTexture.repeat.set(7, 1)
    thresholdTexture.wrapS = thresholdTexture.wrapT = THREE.RepeatWrapping
    thresholdTexture.repeat.set(15 / 2.524, 1)
    thresholdTexture.colorSpace = THREE.SRGBColorSpace
    floorTexture.needsUpdate = true
    railingTexture.needsUpdate = true
    thresholdTexture.needsUpdate = true
  }, [floorTexture, railingTexture, thresholdTexture])

  const floorShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-1.1, -2)
    shape.lineTo(1.1, -2)
    shape.lineTo(7.5, 4)
    shape.lineTo(-7.5, 4)
    shape.closePath()
    return shape
  }, [])
  const floorMaterial = useMemo(
    () => createPublicationsFloorMaterial(floorTexture, paint),
    [floorTexture, paint?.opacity, paint?.onBeforeCompile],
  )
  useEffect(() => () => floorMaterial.dispose(), [floorMaterial])
  const ropeGeometry = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([...PUBLICATION_ROPE_POINTS]),
    64,
    0.015,
    8,
    false,
  ), [])
  const floorOutline = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: '#999999',
      opacity: materialProps.opacity,
      transparent: true,
    })
    if (materialProps.onBeforeCompile) {
      material.onBeforeCompile = materialProps.onBeforeCompile
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(7.5, 4, 0),
        new THREE.Vector3(-7.5, 4, 0),
      ]),
      material,
    )
  }, [materialProps.opacity, materialProps.onBeforeCompile])
  useEffect(() => () => {
    floorOutline.geometry.dispose()
    floorOutline.material.dispose()
  }, [floorOutline])
  useEffect(() => () => ropeGeometry.dispose(), [ropeGeometry])
  const rightCrop = getRightHouseCrop(HOUSES_WIDTH, RIGHT_HOUSE_CROP)
  const rightHousesTexture = useMemo(() => {
    const texture = housesTexture.clone()
    texture.offset.x = rightCrop.offsetX
    texture.repeat.x = rightCrop.repeatX
    texture.needsUpdate = true
    return texture
  }, [housesTexture, rightCrop.offsetX, rightCrop.repeatX])
  useEffect(() => () => rightHousesTexture.dispose(), [rightHousesTexture])

  return (
    <group name="publications-scenery" position={[0, -0.7, -2]}>
      <mesh name="publication-floor" rotation={[-Math.PI / 2, 0, 0]}
        raycast={disableRaycast}>
        <shapeGeometry args={[floorShape]} />
        <primitive object={floorMaterial} />
      </mesh>
      <group name="publication-floor-outline" rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]} raycast={disableRaycast}>
        <primitive object={floorOutline} />
      </group>
      <mesh name="publication-railing" position={[0, RAILING_HEIGHT / 2, -3.9]}
        raycast={disableRaycast}>
        <planeGeometry args={[20, RAILING_HEIGHT]} />
        <meshBasicMaterial {...materialProps} map={railingTexture} transparent
          alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh name="publication-threshold" position={[0, 0.01, -3.9]}
        rotation={[-Math.PI / 2, 0, 0]} raycast={disableRaycast}>
        <planeGeometry args={[15, 0.15]} />
        <meshBasicMaterial {...materialProps} map={thresholdTexture}
          side={THREE.DoubleSide} />
      </mesh>
      <group name="publication-clothesline" position={[0, 1.6, -4]}>
        <mesh name="publication-rope" geometry={ropeGeometry} raycast={disableRaycast}>
          <meshBasicMaterial {...materialProps} color="#666666" />
        </mesh>
        {children}
      </group>
      <mesh name="publication-houses-center" position={[0, -1, -9]}
        raycast={disableRaycast}>
        <planeGeometry args={[HOUSES_WIDTH, HOUSES_HEIGHT]} />
        <meshBasicMaterial {...materialProps} map={housesTexture} transparent
          alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh name="publication-houses-left" position={[-15, -1, -9]}
        scale={[-1, 1, 1]} raycast={disableRaycast}>
        <planeGeometry args={[HOUSES_WIDTH, HOUSES_HEIGHT]} />
        <meshBasicMaterial {...materialProps} map={housesTexture} transparent
          alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh name="publication-houses-right"
        position={[rightCrop.centerX, -1, -9]} scale={[-1, 1, 1]}
        raycast={disableRaycast}>
        <planeGeometry args={[rightCrop.width, HOUSES_HEIGHT]} />
        <meshBasicMaterial {...materialProps} map={rightHousesTexture} transparent
          alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      {[-30, 0, 30].map((x) => (
        <mesh key={x} name={`publication-city-${x}`} position={[x, 3.4, -17]}
          scale={x === 0 ? [1, 1, 1] : [-1, 1, 1]} raycast={disableRaycast}>
          <planeGeometry args={[CITY_WIDTH, CITY_HEIGHT]} />
          <meshBasicMaterial {...materialProps} map={cityTexture} transparent
            alphaTest={0.1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <FlyingBird texture={birdTexture} opacity={materialProps.opacity} />
      <GalleryClouds count={getPublicationCloudCount(tier)} seed={123} />
      <mesh name="publication-sky" position={[0, 5, -20]} raycast={disableRaycast}>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial color="#f0f0f0" side={THREE.BackSide} transparent
          opacity={0.5 * materialProps.opacity}
          onBeforeCompile={materialProps.onBeforeCompile} />
      </mesh>
    </group>
  )
}
