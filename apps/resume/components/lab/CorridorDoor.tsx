import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { audioManager } from '@/lib/audio/audioManager'

// ── Geometry constants (matches itomdev DoorSection) ──────────────────────────
const WALL_X_OUTER    = 3.5
const DOOR_Z_SPAN     = 4
const WALL_DX         = WALL_X_OUTER - 1.7                              // 1.8
const WALL_LENGTH     = Math.sqrt(WALL_DX * WALL_DX + DOOR_Z_SPAN * DOOR_Z_SPAN) // ≈4.387
const CORRIDOR_HEIGHT = 3.5
const BASE_TILT       = 0.02
const MAX_TILT        = Math.atan2(WALL_DX, DOOR_Z_SPAN) + 0.1          // ≈0.523 rad
const TILT_START      = 15
const TILT_PEAK       = 3

const DOOR_WIDTH    = 1.2
const DOOR_HEIGHT   = 2.2
const FLOOR_Y       = -CORRIDOR_HEIGHT / 2                               // -1.75
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2                         // -0.65 — aligns door bottom to floor
// Wall fill on each side of the door opening
const SIDE_WALL_W = (WALL_LENGTH - DOOR_WIDTH) / 2                      // ≈1.594

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
  const wallTex   = useTexture('/textures/corridor/wall_texture.webp')

  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(WALL_LENGTH / 4, CORRIDOR_HEIGHT / 2)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const innerGroupRef = useRef<THREE.Group>(null)  // Bug-1: inner group rotates, outer group is the pivot
  const leftPanelRef  = useRef<THREE.Group>(null)  // Bug-3/6: Group (not Mesh) for edge-pivot hinge
  const rightPanelRef = useRef<THREE.Group>(null)
  const textGroupRef  = useRef<THREE.Group>(null)  // Bug-4: compensate scale.x stretch on label
  const glowRef       = useRef<THREE.Mesh>(null)
  const currentTilt   = useRef(BASE_TILT)
  const isNearRef     = useRef(false)
  const isOpenRef     = useRef(false)

  const { camera } = useThree()

  // Bug-1: pivot is outer wall edge; inner content offset by wallOffsetX
  const pivotX      = side === 'left' ? -WALL_X_OUTER : WALL_X_OUTER
  // wallOffsetX: how far inner content sits from pivot along local X
  const wallOffsetX = side === 'left' ? WALL_LENGTH / 2 : -WALL_LENGTH / 2

  // Bug-6: refs are now THREE.Group
  useEffect(() => {
    if (!isReset) return
    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (left)  { left.rotation.y  = 0; gsap.killTweensOf(left.rotation)  }
    if (right) { right.rotation.y = 0; gsap.killTweensOf(right.rotation) }
    isOpenRef.current = false
  }, [isReset])

  useFrame(() => {
    const inner = innerGroupRef.current
    if (!inner) return

    const dist = Math.abs(camera.position.z - position[2])

    // Tilt ramps from BASE_TILT → MAX_TILT as camera closes in
    let targetTilt = BASE_TILT
    if (dist < TILT_START && dist > TILT_PEAK) {
      const t = (TILT_START - dist) / (TILT_START - TILT_PEAK)
      targetTilt = BASE_TILT + (MAX_TILT - BASE_TILT) * (t * (2 - t))  // easeOutQuad
    } else if (dist <= TILT_PEAK) {
      targetTilt = MAX_TILT
    }
    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetTilt, 0.06)

    const baseDir = side === 'left' ? 1 : -1
    const tiltDir = side === 'left' ? -1 : 1
    const rotation = (Math.PI / 2 * baseDir) + (currentTilt.current * tiltDir)
    inner.rotation.y = rotation

    // Bug-5: scale.x compensates so Z-projection stays = DOOR_Z_SPAN (no squish)
    const absSin = Math.abs(Math.sin(rotation))
    const exactScale = absSin > 0.1 ? (DOOR_Z_SPAN - 0.01) / (WALL_LENGTH * absSin) : 1.0
    inner.scale.x = THREE.MathUtils.clamp(exactScale, 0.8, 1.1)

    // Bug-4: invert scale.x on the Text group so the label doesn't stretch
    if (textGroupRef.current) {
      textGroupRef.current.scale.x = 1 / inner.scale.x
    }

    // Proximity glow
    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        gsap.to(mat, { opacity: near ? 0.22 : 0, duration: 0.5 })
      }
    }
  })

  // Bug-3: tween the hinge Group, not the Mesh — rotation now around edge
  const handleClick = useCallback(() => {
    if (isOpenRef.current) return
    isOpenRef.current = true
    audioManager.play('door_open')
    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    gsap.to(left.rotation,  { y: -Math.PI * 0.52, duration: 0.8, ease: 'power2.inOut' })
    gsap.to(right.rotation, { y:  Math.PI * 0.52, duration: 0.8, ease: 'power2.inOut',
      onComplete: () => onEnter(),
    })
  }, [onEnter])

  const handlePointerEnter = useCallback(() => {
    audioManager.play('door_hover')
  }, [])

  // Wall fill x positions relative to inner group origin (which is at pivot)
  // Content sits at wallOffsetX; door opening is centred there.
  const leftFillX  = wallOffsetX + (side === 'left'
    ? -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
    :   DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
  const rightFillX = wallOffsetX + (side === 'left'
    ?   DOOR_WIDTH / 2 + SIDE_WALL_W / 2
    : -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2))

  return (
    // Bug-1: outer group sits at pivot (±3.5, y, z) — it never rotates
    <group position={[pivotX, position[1], position[2]]}>

      {/* Bug-1: inner group rotates; Bug-5: z=0.005 clears corridor wall z-fighting */}
      <group ref={innerGroupRef} position={[0, 0, 0]}>

        {/* Bug-2: wall fill left of door opening */}
        <mesh position={[leftFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTex} color="#e0ddd4" />
        </mesh>

        {/* Bug-2: wall fill right of door opening */}
        <mesh position={[rightFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTex} color="#e0ddd4" />
        </mesh>

        {/* Door frame — centred at DOOR_CENTER_Y so bottom touches floor */}
        <mesh position={[wallOffsetX, DOOR_CENTER_Y, 0.01]}>
          <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
          <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
        </mesh>

        {/* Left hinge group — origin at left edge of opening, y at door centre */}
        <group
          ref={leftPanelRef}
          position={[wallOffsetX - DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onPointerEnter={handlePointerEnter}
          onClick={handleClick}
        >
          <mesh position={[DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={doorTex} />
          </mesh>
        </group>

        {/* Right hinge group — origin at right edge of opening, y at door centre */}
        <group
          ref={rightPanelRef}
          position={[wallOffsetX + DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onClick={handleClick}
        >
          <mesh position={[-DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={doorTex} />
          </mesh>
        </group>

        {/* Door handle */}
        <mesh position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.07]}>
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
        </mesh>

        {/* Proximity glow */}
        <mesh ref={glowRef} position={[wallOffsetX, DOOR_CENTER_Y, 0]}>
          <planeGeometry args={[DOOR_WIDTH + 1, DOOR_HEIGHT + 1]} />
          <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Label — y above door top, scale.x compensated in useFrame */}
        <group ref={textGroupRef} position={[wallOffsetX, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.3, 0.05]}>
          <Text
            fontSize={0.16}
            color="#8b7355"
            font="/fonts/CabinSketch-Regular.ttf"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        </group>

      </group>
    </group>
  )
}
