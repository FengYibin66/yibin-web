import { useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { audioManager } from '@/lib/audio/audioManager'

const WALL_X_OUTER    = 3.5
const DOOR_Z_SPAN     = 4
const WALL_DX         = WALL_X_OUTER - 1.7
const WALL_LENGTH     = Math.sqrt(WALL_DX * WALL_DX + DOOR_Z_SPAN * DOOR_Z_SPAN)
const CORRIDOR_HEIGHT = 3.5
const BASE_TILT       = 0.02
const MAX_TILT        = Math.atan2(WALL_DX, DOOR_Z_SPAN) + 0.1
const TILT_START      = 15
const TILT_PEAK       = 3

const DOOR_WIDTH    = 1.2
const DOOR_HEIGHT   = 2.2
const FLOOR_Y       = -CORRIDOR_HEIGHT / 2
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2
const SIDE_WALL_W   = (WALL_LENGTH - DOOR_WIDTH) / 2

interface CorridorDoorProps {
  position: [number, number, number]
  side: 'left' | 'right'
  type: string
  label: string
  onEnter: () => void
  isReset?: boolean
}

export function CorridorDoor({ position, side, type, label, onEnter, isReset = false }: CorridorDoorProps) {
  const doorTex    = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const paintedTex = useTexture(`/textures/corridor/doors/drzwi${type}_painted.webp`)
  const handleTex        = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const handlePaintedTex = useTexture('/textures/corridor/doors/klamkadodrzwi_painted.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const wallTex   = useTexture('/textures/corridor/wall_texture.webp')

  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(WALL_LENGTH / 4, CORRIDOR_HEIGHT / 2)

  const innerGroupRef    = useRef<THREE.Group>(null)
  const leftPanelRef     = useRef<THREE.Group>(null)
  const rightPanelRef    = useRef<THREE.Group>(null)
  const textGroupRef     = useRef<THREE.Group>(null)
  const glowRef          = useRef<THREE.Mesh>(null)
  // Sketch overlay refs — fade out on hover to reveal painted layer beneath
  const leftSketchRef    = useRef<THREE.Mesh>(null)
  const rightSketchRef   = useRef<THREE.Mesh>(null)
  const handleSketchRef  = useRef<THREE.Mesh>(null)
  const currentTilt      = useRef(BASE_TILT)
  const isNearRef        = useRef(false)
  const isOpenRef        = useRef(false)

  const { camera } = useThree()

  const pivotX      = side === 'left' ? -WALL_X_OUTER : WALL_X_OUTER
  const wallOffsetX = side === 'left' ? WALL_LENGTH / 2 : -WALL_LENGTH / 2

  useEffect(() => {
    if (!isReset) return
    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (left)  { left.rotation.y  = 0; gsap.killTweensOf(left.rotation)  }
    if (right) { right.rotation.y = 0; gsap.killTweensOf(right.rotation) }
    isOpenRef.current = false
    // Restore sketch overlays
    for (const ref of [leftSketchRef, rightSketchRef, handleSketchRef]) {
      if (ref.current) {
        gsap.killTweensOf(ref.current.material)
        ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 1
      }
    }
  }, [isReset])

  useFrame(() => {
    const inner = innerGroupRef.current
    if (!inner) return

    const dist = Math.abs(camera.position.z - position[2])

    let targetTilt = BASE_TILT
    if (dist < TILT_START && dist > TILT_PEAK) {
      const t = (TILT_START - dist) / (TILT_START - TILT_PEAK)
      targetTilt = BASE_TILT + (MAX_TILT - BASE_TILT) * (t * (2 - t))
    } else if (dist <= TILT_PEAK) {
      targetTilt = MAX_TILT
    }
    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetTilt, 0.06)

    const baseDir = side === 'left' ? 1 : -1
    const tiltDir = side === 'left' ? -1 : 1
    const rotation = (Math.PI / 2 * baseDir) + (currentTilt.current * tiltDir)
    inner.rotation.y = rotation

    const absSin = Math.abs(Math.sin(rotation))
    const exactScale = absSin > 0.1 ? (DOOR_Z_SPAN - 0.01) / (WALL_LENGTH * absSin) : 1.0
    inner.scale.x = THREE.MathUtils.clamp(exactScale, 0.8, 1.1)

    if (textGroupRef.current) {
      textGroupRef.current.scale.x = 1 / inner.scale.x
    }

    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        gsap.to(mat, { opacity: near ? 0.22 : 0, duration: 0.5 })
      }
    }
  })

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
    // Fade out sketch overlays to reveal painted color
    for (const ref of [leftSketchRef, rightSketchRef, handleSketchRef]) {
      if (ref.current) {
        gsap.to(ref.current.material, { opacity: 0, duration: 0.6, ease: 'power2.out', overwrite: true })
      }
    }
  }, [])

  const handlePointerLeave = useCallback(() => {
    // Restore sketch overlays
    for (const ref of [leftSketchRef, rightSketchRef, handleSketchRef]) {
      if (ref.current) {
        gsap.to(ref.current.material, { opacity: 1, duration: 0.4, ease: 'power2.in', overwrite: true })
      }
    }
  }, [])

  const leftFillX  = wallOffsetX + (side === 'left'
    ? -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
    :   DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
  const rightFillX = wallOffsetX + (side === 'left'
    ?   DOOR_WIDTH / 2 + SIDE_WALL_W / 2
    : -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2))

  return (
    <group position={[pivotX, position[1], position[2]]}>
      <group ref={innerGroupRef} position={[0, 0, 0]}>

        {/* Wall fills */}
        <mesh position={[leftFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTex} color="#e0ddd4" />
        </mesh>
        <mesh position={[rightFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTex} color="#e0ddd4" />
        </mesh>

        {/* Door frame */}
        <mesh position={[wallOffsetX, DOOR_CENTER_Y, 0.01]}>
          <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
          <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
        </mesh>

        {/* Left hinge group */}
        <group
          ref={leftPanelRef}
          position={[wallOffsetX - DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          {/* Painted base layer */}
          <mesh position={[DOOR_WIDTH / 2, 0, -0.001]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={paintedTex} transparent />
          </mesh>
          {/* Sketch overlay — fades out on hover */}
          <mesh ref={leftSketchRef} position={[DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={doorTex} transparent opacity={1} />
          </mesh>
        </group>

        {/* Right hinge group */}
        <group
          ref={rightPanelRef}
          position={[wallOffsetX + DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onClick={handleClick}
        >
          {/* Painted base layer */}
          <mesh position={[-DOOR_WIDTH / 2, 0, -0.001]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={paintedTex} transparent />
          </mesh>
          {/* Sketch overlay — fades out on hover */}
          <mesh ref={rightSketchRef} position={[-DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={doorTex} transparent opacity={1} />
          </mesh>
        </group>

        {/* Door handle — painted base + sketch overlay */}
        <mesh position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.065]}>
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial map={handlePaintedTex} transparent alphaTest={0.1} />
        </mesh>
        <mesh ref={handleSketchRef} position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.07]}>
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} opacity={1} />
        </mesh>

        {/* Proximity glow */}
        <mesh ref={glowRef} position={[wallOffsetX, DOOR_CENTER_Y, 0]}>
          <planeGeometry args={[DOOR_WIDTH + 1, DOOR_HEIGHT + 1]} />
          <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Label */}
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
