'use client'

import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'

const WALL_X   = 3.49
const FLOOR_Y  = -1.75
const CEIL_Y   =  1.75

// Pre-allocated vectors to avoid per-frame allocations
const _tempPos   = new THREE.Vector3()
const _tempDir   = new THREE.Vector3()
const _tempScale = new THREE.Vector3()
const _tempEuler = new THREE.Euler()
const _tempQuat  = new THREE.Quaternion()
const _camQuat   = new THREE.Quaternion()

// ── InspectableFrame ─────────────────────────────────────────────────────────

interface InspectableFrameProps {
  side: 'left' | 'right'
  z: number
  textureUrl: string
  width?: number
  height?: number
  yOffset?: number
  setCameraOverride?: (active: boolean) => void
}

function InspectableFrame({
  side,
  z,
  textureUrl,
  width = 1.4,
  height = 1.0,
  yOffset = 0.3,
  setCameraOverride,
}: InspectableFrameProps) {
  const tex     = useTexture(textureUrl)
  const groupRef = useRef<THREE.Group>(null)
  const hovered = useRef(false)
  const [, setIsInspected] = useState(false)
  const isInspectedRef = useRef(false)

  const { camera, viewport } = useThree()

  const x    = side === 'left' ? -WALL_X : WALL_X
  const rotY = side === 'left' ?  Math.PI / 2 : -Math.PI / 2

  const originalPos = useMemo(() => new THREE.Vector3(x, yOffset, z), [x, yOffset, z])
  const originalRot = useMemo(() => new THREE.Euler(0, rotY, 0), [rotY])

  useEffect(() => {
    return () => {
      if (isInspectedRef.current && setCameraOverride) {
        setCameraOverride(false)
      }
    }
  }, [setCameraOverride])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInspectedRef.current) {
        isInspectedRef.current = false
        setIsInspected(false)
        if (setCameraOverride) setCameraOverride(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCameraOverride])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const factor = Math.min(1, delta * 6)

    if (isInspectedRef.current) {
      camera.getWorldDirection(_tempDir)
      const aspectOffset = Math.max(0, 1.8 - viewport.aspect) * 1.5
      const dist = Math.min(2.8, Math.max(1.5, 1.3 + aspectOffset))
      _tempPos.copy(camera.position).add(_tempDir.multiplyScalar(dist))

      camera.getWorldQuaternion(_camQuat)
      _tempEuler.set(-state.pointer.y * 0.3, state.pointer.x * 0.3, 0)
      _tempQuat.setFromEuler(_tempEuler)
      _camQuat.multiply(_tempQuat)

      _tempScale.set(1.2, 1.2, 1.2)
    } else {
      _tempPos.copy(originalPos)
      _camQuat.setFromEuler(originalRot)
      _tempScale.set(1, 1, 1)
    }

    groupRef.current.position.lerp(_tempPos, factor)
    groupRef.current.quaternion.slerp(_camQuat, factor)
    groupRef.current.scale.lerp(_tempScale, factor)
  })

  const onEnter = useCallback(() => {
    if (isInspectedRef.current) return
    hovered.current = true
    if (!groupRef.current) return
    gsap.to(groupRef.current.position, { z: originalPos.z + 0.08, duration: 0.4, ease: 'power2.out', overwrite: true })
    gsap.to(groupRef.current.scale,    { x: 1.06, y: 1.06, duration: 0.4, ease: 'power2.out', overwrite: true })
  }, [originalPos.z])

  const onLeave = useCallback(() => {
    if (isInspectedRef.current) return
    hovered.current = false
    if (!groupRef.current) return
    gsap.to(groupRef.current.position, { z: originalPos.z, duration: 0.35, ease: 'power2.inOut', overwrite: true })
    gsap.to(groupRef.current.scale,    { x: 1, y: 1, duration: 0.35, ease: 'power2.inOut', overwrite: true })
  }, [originalPos.z])

  const onClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const next = !isInspectedRef.current
    isInspectedRef.current = next
    setIsInspected(next)
    if (setCameraOverride) setCameraOverride(next)
  }, [setCameraOverride])

  return (
    <group
      ref={groupRef}
      position={originalPos}
      rotation={originalRot}
    >
      <mesh
        position={[0, 0, 0.05]}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onClick={onClick}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ── Potted plant ──────────────────────────────────────────────────────────────

function CorridorPlant({ side, z }: { side: 'left' | 'right'; z: number }) {
  const tex  = useTexture('/textures/corridor/drzewkowdoniczce.webp')
  const x    = side === 'left' ? -2.8 : 2.8
  const rotY = side === 'left' ?  Math.PI / 2 : -Math.PI / 2

  return (
    <mesh position={[x, FLOOR_Y + 0.9, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[1.0, 1.8]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.05} depthWrite={false} />
    </mesh>
  )
}

// ── Ceiling lamp ──────────────────────────────────────────────────────────────

function CeilingLamp({ z }: { z: number }) {
  const topTex  = useTexture('/textures/corridor/kratanalampy.webp')
  const sideTex = useTexture('/textures/corridor/bokilampy.webp')

  return (
    <group position={[0, CEIL_Y - 0.05, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.4]} />
        <meshBasicMaterial map={topTex} transparent alphaTest={0.05} />
      </mesh>
      {([-1, 1] as const).map((dir) => (
        <mesh key={dir} rotation={[0, dir * Math.PI / 2, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[0.4, 0.2]} />
          <meshBasicMaterial map={sideTex} transparent alphaTest={0.05} />
        </mesh>
      ))}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CorridorDecorationsProps {
  setCameraOverride?: (active: boolean) => void
}

function LoopDecorations({ offsetZ = 0, setCameraOverride }: { offsetZ?: number; setCameraOverride?: (active: boolean) => void }) {
  return (
    <group>
      <InspectableFrame side="right" z={offsetZ - 14} textureUrl="/textures/corridor/rysuneknaobraz1.webp"    width={1.6} height={1.1} yOffset={0.4}  setCameraOverride={setCameraOverride} />
      <InspectableFrame side="left"  z={offsetZ - 26} textureUrl="/textures/corridor/rysuneknaobrazek3.webp"  width={1.4} height={1.0} yOffset={0.3}  setCameraOverride={setCameraOverride} />
      <InspectableFrame side="right" z={offsetZ - 38} textureUrl="/textures/corridor/ramkanazdjecieduza.webp" width={1.5} height={1.1} yOffset={0.35} setCameraOverride={setCameraOverride} />
      <InspectableFrame side="left"  z={offsetZ - 50} textureUrl="/textures/corridor/rysuneknaobraz1.webp"    width={1.4} height={1.0} yOffset={0.3}  setCameraOverride={setCameraOverride} />
      <InspectableFrame side="right" z={offsetZ - 62} textureUrl="/textures/corridor/rysuneknaobrazek3.webp"  width={1.6} height={1.1} yOffset={0.4}  setCameraOverride={setCameraOverride} />
      <CorridorPlant side="left"  z={offsetZ - 4}  />
      <CorridorPlant side="right" z={offsetZ - 60} />
      <CeilingLamp z={offsetZ - 8}  />
      <CeilingLamp z={offsetZ - 20} />
      <CeilingLamp z={offsetZ - 44} />
      <CeilingLamp z={offsetZ - 56} />
    </group>
  )
}

export function CorridorDecorations({ setCameraOverride }: CorridorDecorationsProps) {
  return (
    <group>
      <LoopDecorations offsetZ={0}    setCameraOverride={setCameraOverride} />
      <LoopDecorations offsetZ={-100} setCameraOverride={setCameraOverride} />
    </group>
  )
}
