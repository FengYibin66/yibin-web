'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { audioManager } from '@/lib/audio/audioManager'

const DOOR_HEIGHT   = 2.4
const DOOR_WIDTH    = DOOR_HEIGHT * 0.391
const FLOOR_Y       = -1.75
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2  // -0.55

const OPEN_DIST  = 12
const CLOSE_DIST = 18

interface SegmentDoorProps {
  position: [number, number, number]
  label?: string
}

export function SegmentDoor({ position, label = 'while(true) { explore(); }' }: SegmentDoorProps) {
  const leftTex   = useTexture('/textures/corridor/doors/doorrleft.webp')
  const rightTex  = useTexture('/textures/corridor/doors/dorright.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')

  const leftRef      = useRef<THREE.Group>(null)
  const rightRef     = useRef<THREE.Group>(null)
  const isOpenRef    = useRef(false)
  const isClosingRef = useRef(false)

  const { camera } = useThree()

  useFrame(() => {
    const distZ = Math.abs(camera.position.z - position[2])
    const distX = Math.abs(camera.position.x - position[0])
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    if (distZ < OPEN_DIST && distX < 1.5 && !isOpenRef.current) {
      isOpenRef.current    = true
      isClosingRef.current = false
      audioManager.play('door_open')
      gsap.to(left.rotation,  { y: -Math.PI * 0.55, duration: 0.9, ease: 'power2.out', delay: 0.1 })
      gsap.to(right.rotation, { y:  Math.PI * 0.55, duration: 0.9, ease: 'power2.out', delay: 0.1 })
    }

    if ((distZ > CLOSE_DIST || distX > 2.5) && isOpenRef.current && !isClosingRef.current) {
      isClosingRef.current = true
      isOpenRef.current    = false
      gsap.to(left.rotation,  { y: 0, duration: 0.7, ease: 'power2.in' })
      gsap.to(right.rotation, { y: 0, duration: 0.7, ease: 'power2.in',
        onComplete: () => { isClosingRef.current = false },
      })
    }
  })

  const frameW = DOOR_WIDTH * 2 + 0.2

  return (
    <group position={position}>
      <mesh position={[0, DOOR_CENTER_Y, 0]}>
        <planeGeometry args={[frameW, DOOR_HEIGHT + 0.2]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      <group ref={leftRef} position={[-DOOR_WIDTH, DOOR_CENTER_Y, 0.02]}>
        <mesh position={[DOOR_WIDTH / 2, 0, 0]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={leftTex} />
        </mesh>
      </group>

      <group ref={rightRef} position={[DOOR_WIDTH, DOOR_CENTER_Y, 0.02]}>
        <mesh position={[-DOOR_WIDTH / 2, 0, 0]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={rightTex} />
        </mesh>
      </group>

      <mesh position={[DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.06]}>
        <planeGeometry args={[0.08, 0.22]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>

      <Text
        position={[0, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.35, 0.05]}
        fontSize={0.13}
        color="#8b7355"
        font="/fonts/CabinSketch-Regular.ttf"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.5}
      >
        {label}
      </Text>
    </group>
  )
}
