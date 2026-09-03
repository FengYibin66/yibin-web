'use client'

import { useMemo, useRef } from 'react'
import { useLoader, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CLOUD_TEXTURES, cloudAspect } from '@/lib/lab/cloudTextures'



function seededRandom(seed: number) {
  let s = seed
  return () => { s = Math.sin(s * 9999) * 10000; return s - Math.floor(s) }
}

export interface CloudSpec {
  id: number
  position: [number, number, number]
  scale: number
  opacity: number
  textureIndex: number
  driftSpeed: number
  initialOffset: number
}

export interface CloudFieldOptions {
  count: number
  seed: number
  /** [近, 远] 的高度区间 */
  yRange: readonly [number, number]
  /** [近, 远] 的深度区间（都是负数，近的那端数值更大） */
  zRange: readonly [number, number]
  startX: number
  endX: number
}

/**
 * 云场布局 —— 纯函数，无 three / React 依赖，可直接单测。
 *
 * 提出来的原因（审计 A2）：Contact 房间原先自己画了四个**无贴图**的白色矩形当
 * 云（注释写着 "Simple clouds"）。修法是复用本组件而不是再手搓一份贴图逻辑，
 * 但 Contact 是海景、云比 Publications 的城市屋顶低，所以高度与深度必须可配。
 */
export function buildCloudField(options: CloudFieldOptions): CloudSpec[] {
  const { count, seed, yRange, zRange, startX, endX } = options
  const total = startX - endX
  const rand = seededRandom(seed)
  const [yNear, yFar] = yRange
  const [zNear, zFar] = zRange

  return Array.from({ length: count }, (_, i) => {
    const y = yNear + rand() * (yFar - yNear)
    const z = zNear + rand() * (zFar - zNear)
    const driftSpeed = 0.1 + rand() * 0.15
    const initialOffset = (i / Math.max(count, 1)) * total + rand() * 3
    const initialX = startX - (initialOffset % (total + 10)) + 5
    return {
      id: i,
      position: [initialX, y, z] as [number, number, number],
      scale: 0.5 + rand() * 1.2,
      opacity: 0.4 + rand() * 0.3,
      textureIndex: Math.floor(rand() * CLOUD_TEXTURES.length),
      driftSpeed,
      initialOffset,
    }
  })
}

interface GalleryCloudsProps {
  count?: number
  seed?: number
  rotationOffset?: [number, number, number]
  /** 默认值沿用 Publications 阳台的取值，改动它不影响既有调用方 */
  yRange?: readonly [number, number]
  zRange?: readonly [number, number]
  /** 云的基准宽度（乘 scale） */
  baseWidth?: number
  startX?: number
  endX?: number
}

export function GalleryClouds({
  count = 12,
  seed = 42,
  rotationOffset = [0, -Math.PI / 3, 0],
  yRange = [6, 14],
  zRange = [-5, -35],
  baseWidth = 2.5,
  startX = 40,
  endX = -40,
}: GalleryCloudsProps) {
  const clouds = useMemo(
    () => buildCloudField({ count, seed, yRange, zRange, startX, endX }),
    [count, seed, yRange, zRange, startX, endX],
  )

  return (
    <group>
      {clouds.map(c => (
        <StaticCloud
          key={c.id}
          {...c}
          rotationOffset={rotationOffset}
          startX={startX}
          endX={endX}
          baseWidth={baseWidth}
        />
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
  baseWidth: number
}

function StaticCloud({ position, scale, opacity, textureIndex, driftSpeed, initialOffset, rotationOffset, startX, endX, baseWidth }: StaticCloudProps) {
  const meshRef   = useRef<THREE.Mesh>(null)
  const basePos   = useRef(position)
  const TOTAL     = startX - endX
  const texture   = useLoader(THREE.TextureLoader, CLOUD_TEXTURES[textureIndex])
  const aspect    = cloudAspect(CLOUD_TEXTURES[textureIndex])
  const width     = baseWidth * scale
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
