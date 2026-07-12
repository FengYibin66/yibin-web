'use client'

import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const TOTAL_FRAMES = 9
const FPS           = 20
const DODGE_START   = 3
const DODGE_PEAK    = 0
const DODGE_END     = -2
const DODGE_AMOUNT  = -1.5

const easeOutQuad = (t: number) => t * (2 - t)

interface AvatarProps {
  position?: [number, number, number]
}

export function Avatar({ position = [0, -0.61, -0.3] }: AvatarProps) {
  const framePaths = Array.from({ length: TOTAL_FRAMES }, (_, i) =>
    `/textures/corridor/avatar_anim/${i + 1}.webp`
  )
  const textures = useTexture(framePaths)

  const groupRef    = useRef<THREE.Group>(null)
  const meshRef     = useRef<THREE.Mesh>(null)
  const frameTimer  = useRef(0)
  const currentFrame = useRef(0)
  const isReversing = useRef(false)
  const dodgeX      = useRef(0)
  const targetDodgeX = useRef(0)
  const worldPos    = useRef(new THREE.Vector3())

  const [dimensions, setDimensions] = useState({ width: 1.2, height: 2.3 })
  const { camera } = useThree()

  useEffect(() => {
    textures.forEach(tex => { tex.colorSpace = THREE.SRGBColorSpace })
    const tex0 = textures[0]
    if (tex0?.image) {
      const aspect = tex0.image.width / tex0.image.height
      const h = 2.3
      setDimensions({ width: h * aspect, height: h })
    }
    if (meshRef.current && textures[0]) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.map = textures[0]
      mat.needsUpdate = true
    }
  }, [textures])

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return

    // Dodge: use world position so it works regardless of parent group
    groupRef.current.getWorldPosition(worldPos.current)
    const distance = camera.position.z - worldPos.current.z

    if (distance > DODGE_PEAK && distance < DODGE_START) {
      const t = (DODGE_START - distance) / (DODGE_START - DODGE_PEAK)
      targetDodgeX.current = DODGE_AMOUNT * easeOutQuad(t)
    } else if (distance <= DODGE_PEAK && distance > DODGE_END) {
      const t = (distance - DODGE_END) / (DODGE_PEAK - DODGE_END)
      targetDodgeX.current = DODGE_AMOUNT * easeOutQuad(t)
    } else {
      targetDodgeX.current = 0
    }

    dodgeX.current = THREE.MathUtils.lerp(dodgeX.current, targetDodgeX.current, 0.08)
    groupRef.current.position.x = position[0] + dodgeX.current
    groupRef.current.position.y = position[1]

    // Ping-pong frame animation
    frameTimer.current += delta
    if (frameTimer.current >= 1 / FPS) {
      frameTimer.current = 0

      if (currentFrame.current >= TOTAL_FRAMES - 1) isReversing.current = true
      else if (currentFrame.current <= 0) isReversing.current = false

      if (isReversing.current) currentFrame.current -= 1
      else currentFrame.current += 1

      const idx = Math.max(0, Math.min(TOTAL_FRAMES - 1, currentFrame.current))
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.map = textures[idx]
      mat.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={meshRef}>
        <planeGeometry args={[dimensions.width, dimensions.height]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
