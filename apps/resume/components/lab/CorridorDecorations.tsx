'use client'

import { useRef, useCallback } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

const WALL_X   = 3.49
const FLOOR_Y  = -1.75
const CEIL_Y   =  1.75

// ── Wall painting ─────────────────────────────────────────────────────────────

interface PaintingProps {
  side: 'left' | 'right'
  z: number
  textureUrl: string
  width?: number
  height?: number
  yOffset?: number
}

function WallPainting({ side, z, textureUrl, width = 1.4, height = 1.0, yOffset = 0.3 }: PaintingProps) {
  const tex      = useTexture(textureUrl)
  const meshRef  = useRef<THREE.Mesh>(null)
  const hovered  = useRef(false)

  const x    = side === 'left' ? -WALL_X : WALL_X
  const rotY = side === 'left' ?  Math.PI / 2 : -Math.PI / 2

  const onEnter = useCallback(() => {
    if (hovered.current || !meshRef.current) return
    hovered.current = true
    gsap.to(meshRef.current.position, { z: 0.08, duration: 0.4, ease: 'power2.out' })
    gsap.to(meshRef.current.scale,    { x: 1.06, y: 1.06, duration: 0.4, ease: 'power2.out' })
  }, [])

  const onLeave = useCallback(() => {
    if (!hovered.current || !meshRef.current) return
    hovered.current = false
    gsap.to(meshRef.current.position, { z: 0.02, duration: 0.35, ease: 'power2.inOut' })
    gsap.to(meshRef.current.scale,    { x: 1, y: 1, duration: 0.35, ease: 'power2.inOut' })
  }, [])

  return (
    <group position={[x, yOffset, z]} rotation={[0, rotY, 0]}>
      <mesh
        ref={meshRef}
        position={[0, 0, 0.02]}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
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

// Decoration layout for one corridor loop segment
function LoopDecorations({ offsetZ = 0 }: { offsetZ?: number }) {
  return (
    <group>
      <WallPainting side="right" z={offsetZ - 10} textureUrl="/textures/corridor/rysuneknaobraz1.webp"    width={1.6} height={1.1} yOffset={0.4}  />
      <WallPainting side="left"  z={offsetZ - 25} textureUrl="/textures/corridor/rysuneknaobrazek3.webp"  width={1.4} height={1.0} yOffset={0.3}  />
      <WallPainting side="right" z={offsetZ - 42} textureUrl="/textures/corridor/ramkanazdjecieduza.webp" width={1.5} height={1.1} yOffset={0.35} />
      <WallPainting side="left"  z={offsetZ - 58} textureUrl="/textures/corridor/rysuneknaobraz1.webp"    width={1.4} height={1.0} yOffset={0.3}  />
      <WallPainting side="right" z={offsetZ - 70} textureUrl="/textures/corridor/rysuneknaobrazek3.webp"  width={1.6} height={1.1} yOffset={0.4}  />
      <CorridorPlant side="left"  z={offsetZ - 8}  />
      <CorridorPlant side="right" z={offsetZ - 55} />
      <CeilingLamp z={offsetZ - 5}  />
      <CeilingLamp z={offsetZ - 25} />
      <CeilingLamp z={offsetZ - 50} />
      <CeilingLamp z={offsetZ - 72} />
    </group>
  )
}

export function CorridorDecorations() {
  return (
    <group>
      <LoopDecorations offsetZ={0}    />  {/* Loop 1 */}
      <LoopDecorations offsetZ={-100} />  {/* Loop 2 */}
    </group>
  )
}
