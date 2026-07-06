'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const MAX_EYE_MOVEMENT = 0.015
const FLOOR_Y = -1.75

interface CatProps {
  position?: [number, number, number]
}

export function Cat({ position = [-1.5, FLOOR_Y + 0.6, 0.8] }: CatProps) {
  const leftPupilRef  = useRef<THREE.Mesh>(null)
  const rightPupilRef = useRef<THREE.Mesh>(null)
  const bodyTex = useTexture('/textures/corridor/cat_body.webp')

  useFrame((state) => {
    if (!leftPupilRef.current || !rightPupilRef.current) return
    const { x, y } = state.pointer

    const targetX = x * MAX_EYE_MOVEMENT * 2
    const targetY = y * MAX_EYE_MOVEMENT * 2

    leftPupilRef.current.position.x  = THREE.MathUtils.lerp(leftPupilRef.current.position.x,  -0.075 + targetX, 0.1)
    leftPupilRef.current.position.y  = THREE.MathUtils.lerp(leftPupilRef.current.position.y,   0.28  + targetY, 0.1)
    rightPupilRef.current.position.x = THREE.MathUtils.lerp(rightPupilRef.current.position.x,  0.043 + targetX, 0.1)
    rightPupilRef.current.position.y = THREE.MathUtils.lerp(rightPupilRef.current.position.y,  0.28  + targetY, 0.1)
  })

  return (
    <group position={position}>
      {/* Cat body */}
      <mesh>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={bodyTex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>

      {/* Left pupil */}
      <mesh ref={leftPupilRef} position={[-0.063, 0.27, 0.01]}>
        <circleGeometry args={[0.020, 32]} />
        <meshBasicMaterial color="black" />
      </mesh>

      {/* Right pupil */}
      <mesh ref={rightPupilRef} position={[0.0615, 0.27, 0.01]}>
        <circleGeometry args={[0.020, 32]} />
        <meshBasicMaterial color="black" />
      </mesh>
    </group>
  )
}
