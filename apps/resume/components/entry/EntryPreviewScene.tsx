'use client'

import { useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Cat } from '@/components/lab/Cat'
import * as THREE from 'three'
import gsap from 'gsap'

const FLOOR_Y       = -1.75
const DOOR_WIDTH    = 0.94
const DOOR_HEIGHT   = 2.4
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2  // -0.55

function BrickScene({ onEntered }: { onEntered: () => void }) {
  const brickTex  = useTexture('/textures/entrance/wall_bricks_2.webp')
  const treeTex   = useTexture('/textures/entrance/tree_sketch.webp')
  const winTex    = useTexture('/textures/entrance/window_sketch.webp')
  const potTex    = useTexture('/textures/entrance/pot_with_duck.webp')
  const pathTex   = useTexture('/textures/entrance/stone-path.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const doorTex   = useTexture('/textures/corridor/doors/drzwiabout.webp')
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')

  pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping
  pathTex.repeat.set(1, 2)

  const leftRef   = useRef<THREE.Group>(null)
  const rightRef  = useRef<THREE.Group>(null)
  const isOpenRef = useRef(false)
  const { camera } = useThree()

  const handleClick = () => {
    if (isOpenRef.current) return
    isOpenRef.current = true
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return
    // Left hinge at x=-DOOR_WIDTH → opens toward +Y (into scene)
    gsap.to(left.rotation,   { y:  Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(right.rotation,  { y: -Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(camera.position, { z: 10, duration: 1.5, ease: 'power2.inOut', delay: 0.3, onComplete: onEntered })
  }

  return (
    <group>
      {/* Brick wall background */}
      <mesh position={[0, 0.5, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshBasicMaterial map={brickTex} />
      </mesh>

      {/* Stone path on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.01, 1.5]}>
        <planeGeometry args={[2.4, 4]} />
        <meshBasicMaterial map={pathTex} transparent alphaTest={0.05} />
      </mesh>

      {/* Tree — left */}
      <mesh position={[-2.9, 0.95, 1]}>
        <planeGeometry args={[6, 8]} />
        <meshBasicMaterial map={treeTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* Window — right */}
      <mesh position={[2.5, 0, 0.1]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={winTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* Pot with duck — right lower */}
      <mesh position={[2.5, FLOOR_Y + 0.45, 0.4]}>
        <planeGeometry args={[3, 1.8]} />
        <meshBasicMaterial map={potTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* Door frame — centred at door opening */}
      <mesh position={[0, DOOR_CENTER_Y, 0.12]}>
        <planeGeometry args={[DOOR_WIDTH * 2 + 0.3, DOOR_HEIGHT + 0.3]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left door panel — hinge at left edge x=-DOOR_WIDTH */}
      <group ref={leftRef} position={[-DOOR_WIDTH, DOOR_CENTER_Y, 0.13]}>
        <mesh position={[DOOR_WIDTH / 2, 0, 0]} onClick={handleClick}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={doorTex} />
        </mesh>
      </group>

      {/* Right door panel — hinge at right edge x=+DOOR_WIDTH */}
      <group ref={rightRef} position={[DOOR_WIDTH, DOOR_CENTER_Y, 0.13]}>
        <mesh position={[-DOOR_WIDTH / 2, 0, 0]} onClick={handleClick}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={doorTex} />
        </mesh>
      </group>

      {/* Handle */}
      <mesh position={[DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.05, 0.18]}>
        <planeGeometry args={[0.07, 0.2]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>

      <ambientLight intensity={1.5} color="#ffffff" />
    </group>
  )
}

function EntryCamera({ flying }: { flying: boolean }) {
  const { camera } = useThree()
  useFrame((state) => {
    if (flying) return
    const px = state.pointer.x
    const py = state.pointer.y
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.2, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.3 + py * 0.08, 0.04)
    camera.lookAt(px * 0.1, 0, -3)
  })
  return null
}

export interface EntryPreviewSceneProps { onEnter: () => void }

export function EntryPreviewScene({ onEnter }: EntryPreviewSceneProps) {
  const [flying, setFlying] = useState(false)

  return (
    <Canvas
      camera={{ position: [0, 0.3, 6], fov: 55, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <EntryCamera flying={flying} />
        <BrickScene onEntered={() => { setFlying(true); onEnter() }} />
        <Cat position={[-1.5, FLOOR_Y + 0.6, 0.8]} />
      </Suspense>
    </Canvas>
  )
}
