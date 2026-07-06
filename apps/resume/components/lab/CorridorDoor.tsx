import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

// itomdev wall geometry constants
const WALL_X_OUTER   = 3.5
const WALL_X_INNER   = 1.7
const DOOR_Z_SPAN    = 4
const WALL_DX        = WALL_X_OUTER - WALL_X_INNER          // 1.8
const WALL_LENGTH    = Math.sqrt(WALL_DX * WALL_DX + DOOR_Z_SPAN * DOOR_Z_SPAN) // ≈4.387
const BASE_TILT      = 0.02                                   // static micro-tilt to hint door exists
const MAX_TILT       = Math.atan2(WALL_DX, DOOR_Z_SPAN) + 0.1 // ≈0.523 rad, fully facing user
const TILT_START     = 15                                     // start rotating at this camera distance
const TILT_PEAK      = 3                                      // fully rotated at this distance

interface CorridorDoorProps {
  position: [number, number, number]
  side: 'left' | 'right'
  /** Texture filename suffix: 'about' | 'projekty' | 'kontakt' | 'social' */
  type: string
  label: string
  onEnter: () => void
  isReset?: boolean
}

export function CorridorDoor({ position, side, type, label, onEnter, isReset = false }: CorridorDoorProps) {
  const doorTex   = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')

  const groupRef      = useRef<THREE.Group>(null)
  const leftPanelRef  = useRef<THREE.Mesh>(null)
  const rightPanelRef = useRef<THREE.Mesh>(null)
  const glowRef       = useRef<THREE.Mesh>(null)
  const currentTilt   = useRef(BASE_TILT)
  const isNearRef     = useRef(false)
  const isOpenRef     = useRef(false)

  const { camera } = useThree()

  useEffect(() => {
    if (!isReset) return
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (left)  { left.rotation.y  = 0; gsap.killTweensOf(left.rotation)  }
    if (right) { right.rotation.y = 0; gsap.killTweensOf(right.rotation) }
    isOpenRef.current = false
  }, [isReset])

  const DOOR_WIDTH  = 1.2
  const DOOR_HEIGHT = 2.2

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const dist = Math.abs(camera.position.z - position[2])

    // Compute target tilt based on camera proximity
    let targetTilt = BASE_TILT
    if (dist < TILT_START && dist > TILT_PEAK) {
      const t = (TILT_START - dist) / (TILT_START - TILT_PEAK)
      const easedT = t * (2 - t) // easeOutQuad
      targetTilt = BASE_TILT + (MAX_TILT - BASE_TILT) * easedT
    } else if (dist <= TILT_PEAK) {
      targetTilt = MAX_TILT
    }

    // Smooth tilt
    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetTilt, 0.06)

    // Left wall rotates CCW (negative tilt), right wall CW (positive tilt)
    const baseDir = side === 'left' ? 1 : -1
    const tiltDir = side === 'left' ? -1 : 1
    const rotation = (Math.PI / 2 * baseDir) + (currentTilt.current * tiltDir)
    group.rotation.y = rotation

    // Scale compensation: keep Z-projection = DOOR_Z_SPAN regardless of angle
    const absSin = Math.abs(Math.sin(rotation))
    const exactScale = absSin > 0.1 ? (DOOR_Z_SPAN - 0.01) / (WALL_LENGTH * absSin) : 1.0
    group.scale.x = THREE.MathUtils.clamp(exactScale, 0.8, 1.1)

    // Proximity glow
    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
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
    gsap.to(left.rotation,  { y: -Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut' })
    gsap.to(right.rotation, { y:  Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => onEnter(),
    })
  }, [onEnter])

  return (
    // position.x is ±WALL_X_OUTER (3.5); rotation.y set dynamically in useFrame
    <group ref={groupRef} position={position}>
      {/* Door frame */}
      <mesh>
        <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left door panel — pivots from its left edge */}
      <mesh
        ref={leftPanelRef}
        position={[-DOOR_WIDTH / 4, 0, 0.01]}
        onClick={handleClick}
      >
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Right door panel — pivots from its right edge */}
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

      {/* Room label above door */}
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
