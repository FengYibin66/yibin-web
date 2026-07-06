'use client'

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { audioManager } from '@/lib/audio/audioManager'
import '@/components/lab/shaders/RevealMaterial'

// ─── Geometry constants (itomdev DoorSection values) ──────────────────────────
const WALL_X_OUTER    = 3.5
const DOOR_Z_SPAN     = 4
const WALL_DX         = WALL_X_OUTER - 1.7          // 1.8
const WALL_LENGTH     = Math.sqrt(WALL_DX ** 2 + DOOR_Z_SPAN ** 2)  // ≈4.387
const CORRIDOR_HEIGHT = 3.5
const BASE_TILT       = 0.02
const MAX_TILT        = Math.atan2(WALL_DX, DOOR_Z_SPAN) + 0.1      // ≈0.523 rad
const TILT_START      = 15
const TILT_PEAK       = 3

const DOOR_WIDTH    = 1.2
const DOOR_HEIGHT   = 2.5
const FLOOR_Y       = -CORRIDOR_HEIGHT / 2                           // -1.75
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2                      // -0.5
const SIDE_WALL_W   = (WALL_LENGTH - DOOR_WIDTH) / 2                 // ≈1.594

// Baseboard strip along bottom of wall fill
const BASEBOARD_H   = 0.14
const BASEBOARD_Y   = FLOOR_Y + BASEBOARD_H / 2

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
  // ─── Textures ───────────────────────────────────────────────────────────────
  const doorTex         = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const paintedTex      = useTexture(`/textures/corridor/doors/drzwi${type}_painted.webp`)
  const handleTex       = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const handlePaintedTex= useTexture('/textures/corridor/doors/klamkadodrzwi_painted.webp')
  const frameTex        = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const backTex         = useTexture('/textures/corridor/doors/backsingledoors.webp')
  const wallTex         = useTexture('/textures/corridor/wall_texture.webp')
  const signTex         = useTexture('/textures/corridor/pustatabliczka.webp')
  const arrowTex        = useTexture('/textures/corridor/strzalka.webp')
  const baseboardTex    = useTexture('/textures/corridor/texturadoprogow.webp')

  // Each door section needs its own texture repeat settings — clone to avoid sharing
  const wallTexClone = useMemo(() => {
    const t = wallTex.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(0.5, 0.5)
    t.offset.set(0.5, 0.5)
    return t
  }, [wallTex])

  const baseboardTexClone = useMemo(() => {
    const t = baseboardTex.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    // Baseboard texture 1582×94 px — tile horizontally across SIDE_WALL_W
    t.repeat.set(SIDE_WALL_W / 2.5, 1)
    return t
  }, [baseboardTex])

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const innerGroupRef   = useRef<THREE.Group>(null)
  const leftPanelRef    = useRef<THREE.Group>(null)
  const rightPanelRef   = useRef<THREE.Group>(null)
  const textGroupRef    = useRef<THREE.Group>(null)
  const arrowGroupRef   = useRef<THREE.Group>(null)
  const glowRef         = useRef<THREE.Mesh>(null)
  // RevealMaterial refs — GLSL uProgress brush-stroke discard
  const leftRevealRef   = useRef<{ uProgress: number } | null>(null)
  const rightRevealRef  = useRef<{ uProgress: number } | null>(null)
  const handleRevealRef = useRef<{ uProgress: number } | null>(null)
  const handlePaintedRef= useRef<THREE.Mesh>(null)

  const currentTilt  = useRef(BASE_TILT)
  const isNearRef    = useRef(false)
  const isOpenRef    = useRef(false)
  const hideDelayRef = useRef<gsap.core.Tween | null>(null)

  const { camera } = useThree()

  const pivotX      = side === 'left' ? -WALL_X_OUTER : WALL_X_OUTER
  const wallOffsetX = side === 'left' ? WALL_LENGTH / 2 : -WALL_LENGTH / 2

  // ─── Reset on corridor re-enter ─────────────────────────────────────────────
  useEffect(() => {
    if (!isReset) return
    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (left)  { left.rotation.y  = 0; gsap.killTweensOf(left.rotation)  }
    if (right) { right.rotation.y = 0; gsap.killTweensOf(right.rotation) }
    isOpenRef.current = false
    // Restore reveal materials
    for (const ref of [leftRevealRef, rightRevealRef, handleRevealRef]) {
      if (ref.current) ref.current.uProgress = 0
    }
    if (handlePaintedRef.current) handlePaintedRef.current.visible = false
  }, [isReset])

  // ─── Per-frame: tilt, scale-compensation, glow, arrows ──────────────────────
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

    const baseDir  = side === 'left' ? 1 : -1
    const tiltDir  = side === 'left' ? -1 : 1
    const rotation = (Math.PI / 2 * baseDir) + (currentTilt.current * tiltDir)
    inner.rotation.y = rotation

    const absSin = Math.abs(Math.sin(rotation))
    const exactScale = absSin > 0.1 ? (DOOR_Z_SPAN - 0.01) / (WALL_LENGTH * absSin) : 1.0
    inner.scale.x = THREE.MathUtils.clamp(exactScale, 0.8, 1.1)

    // Invert scale on text label so it doesn't stretch
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
      // Show/hide arrow hints
      if (arrowGroupRef.current) {
        gsap.to(arrowGroupRef.current, {
          opacity: near ? 1 : 0, duration: 0.5,
        })
        arrowGroupRef.current.visible = near
      }
    }
  })

  // ─── Click: open door ────────────────────────────────────────────────────────
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

  // ─── Hover: RevealMaterial brush-stroke discard ──────────────────────────────
  const handlePointerEnter = useCallback(() => {
    audioManager.play('door_hover')
    for (const ref of [leftRevealRef, rightRevealRef, handleRevealRef]) {
      if (ref.current) gsap.to(ref.current, { uProgress: 1.0, duration: 0.8, ease: 'power2.out', overwrite: true })
    }
    if (hideDelayRef.current) hideDelayRef.current.kill()
    if (handlePaintedRef.current) handlePaintedRef.current.visible = true
  }, [])

  const handlePointerLeave = useCallback(() => {
    for (const ref of [leftRevealRef, rightRevealRef, handleRevealRef]) {
      if (ref.current) gsap.to(ref.current, { uProgress: 0.0, duration: 0.5, ease: 'power2.out', overwrite: true })
    }
    // Delay hiding painted handle until after reverse animation
    hideDelayRef.current = gsap.delayedCall(0.55, () => {
      if (handlePaintedRef.current) handlePaintedRef.current.visible = false
    })
  }, [])

  // ─── Wall fill x positions ───────────────────────────────────────────────────
  const leftFillX  = wallOffsetX + (side === 'left'
    ? -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
    :   DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
  const rightFillX = wallOffsetX + (side === 'left'
    ?   DOOR_WIDTH / 2 + SIDE_WALL_W / 2
    : -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2))

  return (
    // Outer group: pivot at outer wall edge — never rotates
    <group position={[pivotX, position[1], position[2]]}>
      {/* Inner group: rotates + scales in useFrame */}
      <group ref={innerGroupRef}>

        {/* ── Wall fill left of door opening ──────────────────────────────── */}
        <mesh position={[leftFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTexClone} color="#e0ddd4" />
        </mesh>
        {/* Baseboard strip */}
        <mesh position={[leftFillX, BASEBOARD_Y, 0.008]}>
          <planeGeometry args={[SIDE_WALL_W, BASEBOARD_H]} />
          <meshBasicMaterial map={baseboardTexClone} color="#c8c4b8" />
        </mesh>

        {/* ── Wall fill right of door opening ─────────────────────────────── */}
        <mesh position={[rightFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTexClone} color="#e0ddd4" />
        </mesh>
        <mesh position={[rightFillX, BASEBOARD_Y, 0.008]}>
          <planeGeometry args={[SIDE_WALL_W, BASEBOARD_H]} />
          <meshBasicMaterial map={baseboardTexClone} color="#c8c4b8" />
        </mesh>

        {/* ── Door frame ───────────────────────────────────────────────────── */}
        <mesh position={[wallOffsetX, DOOR_CENTER_Y, 0.01]}>
          <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
          <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
        </mesh>

        {/* ── Left hinge group — origin at left edge, rotates around hinge ── */}
        <group
          ref={leftPanelRef}
          position={[wallOffsetX - DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          {/* Painted base layer (always visible, revealed as sketch fades) */}
          <mesh position={[DOOR_WIDTH / 2, 0, -0.001]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={paintedTex} transparent alphaTest={0.3} />
          </mesh>
          {/* Sketch overlay with RevealMaterial — brush-stroke discard on hover */}
          <mesh position={[DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            {/* @ts-expect-error revealMaterial registered via extend() */}
            <revealMaterial
              ref={leftRevealRef}
              map={doorTex}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              uProgress={0}
            />
          </mesh>
          {/* Door back face */}
          <mesh position={[DOOR_WIDTH / 2, 0, -0.005]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={backTex} transparent alphaTest={0.3} />
          </mesh>
        </group>

        {/* ── Right hinge group ────────────────────────────────────────────── */}
        <group
          ref={rightPanelRef}
          position={[wallOffsetX + DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onClick={handleClick}
        >
          <mesh position={[-DOOR_WIDTH / 2, 0, -0.001]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={paintedTex} transparent alphaTest={0.3} />
          </mesh>
          <mesh position={[-DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            {/* @ts-expect-error revealMaterial registered via extend() */}
            <revealMaterial
              ref={rightRevealRef}
              map={doorTex}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              uProgress={0}
            />
          </mesh>
          <mesh position={[-DOOR_WIDTH / 2, 0, -0.005]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={backTex} transparent alphaTest={0.3} />
          </mesh>
        </group>

        {/* ── Door handle: painted (hidden) + sketch RevealMaterial ─────────── */}
        <mesh
          ref={handlePaintedRef}
          position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.065]}
          visible={false}
        >
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial map={handlePaintedTex} transparent alphaTest={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.07]}>
          <planeGeometry args={[0.08, 0.22]} />
          {/* @ts-expect-error revealMaterial registered via extend() */}
          <revealMaterial
            ref={handleRevealRef}
            map={handleTex}
            transparent
            alphaTest={0.1}
            depthWrite={false}
            uProgress={0}
          />
        </mesh>

        {/* ── Proximity glow ───────────────────────────────────────────────── */}
        <mesh ref={glowRef} position={[wallOffsetX, DOOR_CENTER_Y, 0]}>
          <planeGeometry args={[DOOR_WIDTH + 1.2, DOOR_HEIGHT + 1.2]} />
          <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* ── Room label sign (pustatabliczka wooden board) ────────────────── */}
        <group ref={textGroupRef} position={[wallOffsetX, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.22, 0.06]}>
          {/* Wooden sign background */}
          <mesh>
            <planeGeometry args={[0.9, 0.35]} />
            <meshBasicMaterial map={signTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
          {/* Room name text on top */}
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.11}
            color="#5c4a2a"
            font="/fonts/CabinSketch-Bold.ttf"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.75}
          >
            {label}
          </Text>
        </group>

        {/* ── Arrow hints (strzalka) — shown when camera is near ───────────── */}
        <group ref={arrowGroupRef} visible={false} position={[wallOffsetX, DOOR_CENTER_Y, 0.06]}>
          {/* Left arrow */}
          <mesh position={[-(DOOR_WIDTH / 2 + 0.35), 0, 0]} rotation={[0, 0, 0]}>
            <planeGeometry args={[0.3, 0.3]} />
            <meshBasicMaterial map={arrowTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
          {/* Right arrow — mirrored */}
          <mesh position={[(DOOR_WIDTH / 2 + 0.35), 0, 0]} scale={[-1, 1, 1]}>
            <planeGeometry args={[0.3, 0.3]} />
            <meshBasicMaterial map={arrowTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
        </group>

      </group>
    </group>
  )
}
