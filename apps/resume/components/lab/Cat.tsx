'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

import { useCatEyes } from './companions/useCatEyes'

const FLOOR_Y = -1.75

interface CatProps {
  position?: [number, number, number]
}

/**
 * 入口页那只猫（门的预览里坐着的那只）。
 *
 * 瞳孔跟随逻辑已抽到 `companions/useCatEyes` —— 走廊柜子上还有一只
 * （`companions/ResidentCat`，守着相框），同一个行为不写两遍。
 */
export function Cat({ position = [-1.5, FLOOR_Y + 0.6, 0.8] }: CatProps) {
  const leftPupilRef  = useRef<THREE.Mesh>(null)
  const rightPupilRef = useRef<THREE.Mesh>(null)
  const bodyTex = useTexture('/textures/corridor/cat_body.webp')

  useCatEyes(
    { left: leftPupilRef, right: rightPupilRef },
    { left: [-0.075, 0.28], right: [0.043, 0.28] },
  )

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
