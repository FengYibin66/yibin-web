'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

interface DoodleConfig {
  texture: string
  position: [number, number, number]
  scale: number
  rotSpeed: number
  floatSpeed: number
  floatAmount: number
  initialRot: number
}

// Positions spread across the full visible frustum at z≈0 (corridor entrance view)
// x: -2.5..2.5 (wide), y: -1..1.2 (floor to near-ceiling), z: 0.2..0.8 (near camera)
const CORRIDOR_DOODLES: DoodleConfig[] = [
  { texture: '/textures/corridor/doodles/paper_airplane.webp', position: [ 1.8,  0.9,  0.5], scale: 0.9,  rotSpeed: 0.15,  floatSpeed: 0.7,  floatAmount: 0.06, initialRot:  0.3  },
  { texture: '/textures/corridor/doodles/paper_ball.webp',     position: [-1.8, -0.5,  0.6], scale: 0.7,  rotSpeed: 0.4,   floatSpeed: 0.5,  floatAmount: 0.03, initialRot:  0.1  },
  { texture: '/textures/corridor/doodles/paper_ball.webp',     position: [-2.2,  0.7,  0.3], scale: 0.55, rotSpeed: -0.3,  floatSpeed: 0.6,  floatAmount: 0.04, initialRot: -0.2  },
  { texture: '/textures/corridor/doodles/pencil.webp',         position: [ 2.0, -0.7,  0.7], scale: 0.85, rotSpeed: 0.1,   floatSpeed: 0.4,  floatAmount: 0.03, initialRot:  0.5  },
  { texture: '/textures/corridor/doodles/coffee_cup.webp',     position: [ 2.3,  0.4,  0.2], scale: 0.65, rotSpeed: 0.05,  floatSpeed: 0.35, floatAmount: 0.04, initialRot: -0.1  },
]

function SketchElement({ texture, position, scale, rotSpeed, floatSpeed, floatAmount, initialRot }: DoodleConfig) {
  const tex = useTexture(texture)
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ref.current) return
    const time = state.clock.elapsedTime
    ref.current.position.y = position[1] + Math.sin(time * floatSpeed + position[0]) * floatAmount
    ref.current.rotation.z = initialRot + Math.sin(time * rotSpeed) * 0.1
    const pulse = 1 + Math.sin(time * 1.5 + position[0] * 2) * 0.03
    ref.current.scale.setScalar(scale * pulse)
  })

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.05} depthWrite={false} />
    </mesh>
  )
}

interface DoodlesProps {
  offsetZ?: number
}

export function Doodles({ offsetZ = 0 }: DoodlesProps) {
  return (
    <group position={[0, 0, offsetZ]}>
      {CORRIDOR_DOODLES.map((cfg, i) => (
        <SketchElement key={i} {...cfg} />
      ))}
    </group>
  )
}
