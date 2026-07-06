'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const TOTAL_FRAMES = 9
const FPS = 20
const FLOOR_Y = -1.75   // CORRIDOR_HEIGHT / 2
const DODGE_START = 3
const DODGE_PEAK = 0
const DODGE_END = -2
const DODGE_AMOUNT = -1.5
const AVATAR_Z = 4

export function Avatar() {
  const framePaths = Array.from({ length: TOTAL_FRAMES }, (_, i) =>
    `/textures/corridor/avatar_anim/${i + 1}.webp`
  )
  const textures = useTexture(framePaths)

  const meshRef = useRef<THREE.Mesh>(null)
  const frameTimer = useRef(0)
  const currentFrame = useRef(0)
  const isReversing = useRef(false)
  const dodgeX = useRef(0)
  const targetDodgeX = useRef(0)

  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!meshRef.current) return

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

    // Dodge when camera approaches
    const distance = camera.position.z - AVATAR_Z
    const easeOut = (t: number) => t * (2 - t)

    if (distance > DODGE_PEAK && distance < DODGE_START) {
      const t = (DODGE_START - distance) / (DODGE_START - DODGE_PEAK)
      targetDodgeX.current = DODGE_AMOUNT * easeOut(t)
    } else if (distance <= DODGE_PEAK && distance > DODGE_END) {
      const t = (distance - DODGE_END) / (DODGE_PEAK - DODGE_END)
      targetDodgeX.current = DODGE_AMOUNT * easeOut(t)
    } else {
      targetDodgeX.current = 0
    }

    dodgeX.current = THREE.MathUtils.lerp(dodgeX.current, targetDodgeX.current, 0.08)
    meshRef.current.position.x = 0.8 + dodgeX.current
  })

  return (
    <mesh
      ref={meshRef}
      position={[0.8, FLOOR_Y + 1.1, AVATAR_Z]}
    >
      <planeGeometry args={[1.4, 2.0]} />
      <meshBasicMaterial
        map={textures[0]}
        transparent
        alphaTest={0.01}
        depthWrite={false}
      />
    </mesh>
  )
}
