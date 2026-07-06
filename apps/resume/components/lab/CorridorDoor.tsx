import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

interface CorridorDoorProps {
  position: [number, number, number]
  side: 'left' | 'right'
  /** Matches texture filename: 'about' | 'projekty' | 'kontakt' | 'social' */
  type: string
  label: string
  onEnter: () => void
  isReset?: boolean  // when true, reset door to closed state
}

export function CorridorDoor({ position, side, type, label, onEnter, isReset = false }: CorridorDoorProps) {
  const doorTex   = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')

  const leftPanelRef  = useRef<THREE.Mesh>(null)
  const rightPanelRef = useRef<THREE.Mesh>(null)
  const glowRef       = useRef<THREE.Mesh>(null)
  const isNearRef     = useRef(false)
  const isOpenRef     = useRef(false)

  const { camera } = useThree()

  useEffect(() => {
    if (!isReset) return
    // Reset door to closed position
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (left) { left.rotation.y = 0; gsap.killTweensOf(left.rotation) }
    if (right) { right.rotation.y = 0; gsap.killTweensOf(right.rotation) }
    isOpenRef.current = false
  }, [isReset])

  const DOOR_WIDTH  = 1.2
  const DOOR_HEIGHT = 2.2

  // Rotation based on which wall the door is on
  const wallRotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2

  useFrame(() => {
    const dist = Math.abs(camera.position.z - position[2])
    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
      // Animate glow opacity
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        gsap.to(mat, { opacity: near ? 0.25 : 0, duration: 0.5 })
      }
    }
  })

  const handleClick = useCallback(() => {
    if (isOpenRef.current) return
    isOpenRef.current = true

    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return

    // Open door panels outward
    gsap.to(left.rotation,  { y: -Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut' })
    gsap.to(right.rotation, { y: Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => onEnter()
    })
  }, [wallRotY, onEnter])

  return (
    <group position={position} rotation={[0, wallRotY, 0]}>
      {/* Door frame */}
      <mesh>
        <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left door panel */}
      <mesh
        ref={leftPanelRef}
        position={[-DOOR_WIDTH / 4, 0, 0.01]}
        onClick={handleClick}
      >
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Right door panel */}
      <mesh
        ref={rightPanelRef}
        position={[DOOR_WIDTH / 4, 0, 0.01]}
        onClick={handleClick}
      >
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Door handle */}
      <mesh position={[DOOR_WIDTH * 0.1, -0.1, 0.06]}>
        <planeGeometry args={[0.08, 0.22]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Proximity glow */}
      <mesh ref={glowRef} position={[0, 0, -0.05]}>
        <planeGeometry args={[DOOR_WIDTH + 1, DOOR_HEIGHT + 1]} />
        <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Label above door — no font prop (no local font file present, uses drei default) */}
      <Text
        position={[0, DOOR_HEIGHT / 2 + 0.3, 0.1]}
        fontSize={0.18}
        color="#8b7355"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}
