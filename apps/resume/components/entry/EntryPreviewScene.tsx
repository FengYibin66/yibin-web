'use client'

import { useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { CorridorGeometry } from '@/components/lab/CorridorGeometry'
import { Cat } from '@/components/lab/Cat'
import { Doodles } from '@/components/lab/Doodles'
import * as THREE from 'three'
import gsap from 'gsap'

const DOOR_WIDTH  = 1.4
const DOOR_HEIGHT = 2.4
const FLOOR_Y     = -1.75

function EntranceDoor({ onEntered }: { onEntered: () => void }) {
  const doorTex   = useTexture('/textures/corridor/doors/drzwiabout.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')

  const leftRef   = useRef<THREE.Mesh>(null)
  const rightRef  = useRef<THREE.Mesh>(null)
  const isOpenRef = useRef(false)

  const { camera } = useThree()

  const handleClick = () => {
    if (isOpenRef.current) return
    isOpenRef.current = true

    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    gsap.to(left.rotation,   { y: -Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(right.rotation,  { y:  Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(camera.position, {
      z: 12,
      duration: 1.5,
      ease: 'power2.inOut',
      delay: 0.3,
      onComplete: onEntered,
    })
  }

  return (
    <group position={[0, 0, -2]}>
      {/* Frame */}
      <mesh>
        <planeGeometry args={[DOOR_WIDTH + 0.3, DOOR_HEIGHT + 0.3]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left panel */}
      <mesh ref={leftRef} position={[-DOOR_WIDTH / 4, 0, 0.01]} onClick={handleClick}>
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Right panel */}
      <mesh ref={rightRef} position={[DOOR_WIDTH / 4, 0, 0.01]} onClick={handleClick}>
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Handle */}
      <mesh position={[DOOR_WIDTH * 0.08, -0.1, 0.07]}>
        <planeGeometry args={[0.07, 0.2]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>
    </group>
  )
}

function EntryCamera({ flying }: { flying: boolean }) {
  const { camera } = useThree()

  useFrame((state) => {
    if (flying) return
    const px = state.pointer.x
    const py = state.pointer.y
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.25, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.5 + py * 0.1, 0.04)
    camera.lookAt(px * 0.1, 0.2, -5)
  })

  return null
}

export function EntryPreviewScene({ onEnter }: { onEnter: () => void }) {
  const [flying, setFlying] = useState(false)

  return (
    <Canvas
      camera={{ position: [0, 0.5, 8], fov: 50, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <EntryCamera flying={flying} />
        <CorridorGeometry />
        <EntranceDoor onEntered={onEnter} />
        <Cat position={[-1.5, FLOOR_Y + 0.6, 1]} />
        <Doodles offsetZ={3} />
      </Suspense>
    </Canvas>
  )
}
