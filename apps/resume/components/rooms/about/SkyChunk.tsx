'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

export const CHUNK_LENGTH = 40
export const CHUNK_WIDTH  = 20
export const CHUNK_HEIGHT = 12

// Hard world-space clip — anything behind corridor entrance is invisible
export const CORRIDOR_CLIP_Z = -8.0
// AboutRoom group position.z in world space
export const ROOM_Z = -25

const CLOUD_TEXTURES = [
  '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
  '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
  '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
  '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
  '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
  '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
  '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
  '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
]

// Original aspect ratios to prevent GPU POT-conversion stretching
const LEGACY_CLOUD_ASPECTS: Record<string, number> = {
  '1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp': 1.894,
  '254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp': 2.459,
  '2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp': 3.577,
  '5606fcc0-3252-447d-a58a-7bcbac73229a.webp': 1.794,
  '7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp': 1.997,
  '9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp': 1.905,
  'c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp': 3,
  'f6e358bc-d27c-41dd-95f4-6787a835c41e.webp': 1.875,
}

function seededRandom(seed: number) {
  let s = seed
  return function () {
    s = Math.sin(s * 9999) * 10000
    return s - Math.floor(s)
  }
}

// ─── Cloud ────────────────────────────────────────────────────────────────────

interface CloudProps {
  position: [number, number, number]
  scale: number
  baseOpacity: number
  textureIndex: number
  driftSpeed?: number
  driftAmount?: number
  bobAmount?: number
  timeOffset?: number
  scrollProgressRef: React.MutableRefObject<number>
}

function Cloud({
  position,
  scale,
  baseOpacity,
  textureIndex,
  driftSpeed = 0.5,
  driftAmount = 0.8,
  bobAmount = 0.15,
  timeOffset = 0,
  scrollProgressRef,
}: CloudProps) {
  const meshRef     = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const { camera }  = useThree()
  const basePos     = useRef(position)

  const texture = useLoader(THREE.TextureLoader, CLOUD_TEXTURES[textureIndex])

  const cloudFile   = CLOUD_TEXTURES[textureIndex].split('/').pop() ?? ''
  const aspectRatio = LEGACY_CLOUD_ASPECTS[cloudFile] ?? 1.8
  const width  = 3 * scale
  const height = width / aspectRatio

  useFrame((state) => {
    if (!meshRef.current) return
    const time           = state.clock.elapsedTime
    const scrollProgress = scrollProgressRef.current

    // Hard clip: hide if world-Z is behind corridor entrance
    const worldZ = ROOM_Z + scrollProgress + basePos.current[2]

    // Cloud evasion — push apart as they approach camera
    const evasionStart = -60
    const evasionEnd   = -10
    let evasionFactor  = 0
    if (worldZ > evasionStart && worldZ < evasionEnd) {
      evasionFactor = (worldZ - evasionStart) / (evasionEnd - evasionStart)
      evasionFactor = evasionFactor * evasionFactor * (3 - 2 * evasionFactor) // smoothstep
    } else if (worldZ >= evasionEnd) {
      evasionFactor = 1
    }
    const dirX      = basePos.current[0] >= 0 ? 1 : -1
    const evasionX  = evasionFactor * 15 * dirX
    const driftX    = Math.sin(time * driftSpeed + timeOffset) * driftAmount
    const driftY    = Math.sin(time * driftSpeed * 0.7 + timeOffset + 1.5) * bobAmount

    meshRef.current.position.x = basePos.current[0] + driftX + evasionX
    meshRef.current.position.y = basePos.current[1] + driftY
    meshRef.current.position.z = basePos.current[2]

    if (materialRef.current) {
      materialRef.current.opacity = worldZ > CORRIDOR_CLIP_Z ? 0 : baseOpacity
    }

    // Billboard: always face camera, rotated 90° left
    const offsetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 3, 0))
    meshRef.current.quaternion.copy(camera.quaternion).multiply(offsetQ)
  })

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#e0e0e0"
        map={texture}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ─── SkyChunk ─────────────────────────────────────────────────────────────────

interface SkyChunkProps {
  chunkIndex?: number
  seed?: number
  scrollProgressRef: React.MutableRefObject<number>
}

interface CloudData {
  id: string
  position: [number, number, number]
  scale: number
  baseOpacity: number
  textureIndex: number
  driftSpeed: number
  driftAmount: number
  bobAmount: number
  timeOffset: number
}

export default function SkyChunk({ chunkIndex = 0, seed = 0, scrollProgressRef }: SkyChunkProps) {
  const zOffset = -(chunkIndex * CHUNK_LENGTH) - 15

  const clouds = useMemo<CloudData[]>(() => {
    const items: CloudData[] = []
    const random     = seededRandom(seed + chunkIndex * 1000)
    const cloudCount = 15 + Math.floor(random() * 8)

    for (let i = 0; i < cloudCount; i++) {
      const x = (random() - 0.5) * CHUNK_WIDTH
      const y = (random() - 0.5) * CHUNK_HEIGHT
      const z = zOffset - random() * CHUNK_LENGTH
      items.push({
        id:           `${chunkIndex}-${i}`,
        position:     [x, y, z],
        scale:        0.8 + random() * 1.5,
        baseOpacity:  0.5 + random() * 0.4,
        textureIndex: Math.floor(random() * CLOUD_TEXTURES.length),
        driftSpeed:   0.3 + random() * 0.4,
        driftAmount:  0.5 + random() * 1.0,
        bobAmount:    0.1 + random() * 0.2,
        timeOffset:   random() * Math.PI * 2,
      })
    }
    return items
  }, [chunkIndex, seed, zOffset])

  return (
    <group>
      {clouds.map((cloud) => (
        <Cloud
          key={cloud.id}
          position={cloud.position}
          scale={cloud.scale}
          baseOpacity={cloud.baseOpacity}
          textureIndex={cloud.textureIndex}
          driftSpeed={cloud.driftSpeed}
          driftAmount={cloud.driftAmount}
          bobAmount={cloud.bobAmount}
          timeOffset={cloud.timeOffset}
          scrollProgressRef={scrollProgressRef}
        />
      ))}
    </group>
  )
}
