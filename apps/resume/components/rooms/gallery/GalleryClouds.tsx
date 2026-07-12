'use client'

import { useMemo, useRef } from 'react'
import { useLoader, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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

const LEGACY_ASPECTS: Record<string, number> = {
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
  return () => { s = Math.sin(s * 9999) * 10000; return s - Math.floor(s) }
}

interface GalleryCloudsProps {
  count?: number
  seed?: number
  rotationOffset?: [number, number, number]
}

export function GalleryClouds({ count = 12, seed = 42, rotationOffset = [0, -Math.PI / 3, 0] }: GalleryCloudsProps) {
  const START_X = 40, END_X = -40
  const TOTAL   = START_X - END_X

  const clouds = useMemo(() => {
    const rand = seededRandom(seed)
    return Array.from({ length: count }, (_, i) => {
      const y            = 6 + rand() * 8
      const z            = -5 - rand() * 30
      const driftSpeed   = 0.1 + rand() * 0.15
      const initialOffset = (i / count) * TOTAL + rand() * 3
      const initialX     = START_X - (initialOffset % (TOTAL + 10)) + 5
      return { id: i, position: [initialX, y, z] as [number, number, number], scale: 0.5 + rand() * 1.2, opacity: 0.4 + rand() * 0.3, textureIndex: Math.floor(rand() * CLOUD_TEXTURES.length), driftSpeed, initialOffset }
    })
  }, [count, seed, TOTAL, START_X])

  return (
    <group>
      {clouds.map(c => (
        <StaticCloud key={c.id} {...c} rotationOffset={rotationOffset} startX={START_X} endX={END_X} />
      ))}
    </group>
  )
}

interface StaticCloudProps {
  position: [number, number, number]
  scale: number
  opacity: number
  textureIndex: number
  driftSpeed: number
  initialOffset: number
  rotationOffset: [number, number, number]
  startX: number
  endX: number
}

function StaticCloud({ position, scale, opacity, textureIndex, driftSpeed, initialOffset, rotationOffset, startX, endX }: StaticCloudProps) {
  const meshRef   = useRef<THREE.Mesh>(null)
  const basePos   = useRef(position)
  const TOTAL     = startX - endX
  const texture   = useLoader(THREE.TextureLoader, CLOUD_TEXTURES[textureIndex])
  const filename  = CLOUD_TEXTURES[textureIndex].split('/').pop()!
  const aspect    = LEGACY_ASPECTS[filename] ?? 1.8
  const width     = 2.5 * scale
  const height    = width / aspect

  useFrame(({ camera, clock }) => {
    if (!meshRef.current) return
    const progress = ((clock.getElapsedTime() * driftSpeed + initialOffset) % (TOTAL + 10)) - 5
    meshRef.current.position.x = startX - progress
    meshRef.current.position.y = basePos.current[1]
    meshRef.current.position.z = basePos.current[2]
    const offsetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotationOffset))
    meshRef.current.quaternion.copy(camera.quaternion).multiply(offsetQ)
  })

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color="#e0e0e0" map={texture} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
