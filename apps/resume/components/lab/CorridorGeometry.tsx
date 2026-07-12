'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

export const CORRIDOR_HEIGHT = 3.5
export const CORRIDOR_WIDTH  = 7
export const FLOOR_Y         = -CORRIDOR_HEIGHT / 2   // -1.75
export const CEILING_Y       =  CORRIDOR_HEIGHT / 2   //  1.75

interface CorridorGeometryProps {
  zStart: number
  length: number
}

export function CorridorGeometry({ zStart, length }: CorridorGeometryProps) {
  const floorTex    = useTexture('/textures/corridor/kawalekpodlogi.webp')
  const wallTex     = useTexture('/textures/corridor/wall_texture.webp')
  const ceilingTex  = useTexture('/textures/corridor/ceiling_texture.webp')
  const baseboardTex = useTexture('/textures/corridor/texturadoprogow.webp')

  floorTex.wrapS = floorTex.wrapT = THREE.ClampToEdgeWrapping

  const [wt, ct, bt] = useMemo(() => {
    const w = wallTex.clone();    w.needsUpdate = true
    const c = ceilingTex.clone(); c.needsUpdate = true
    const b = baseboardTex.clone(); b.needsUpdate = true

    w.wrapS = w.wrapT = THREE.RepeatWrapping
    w.repeat.set(length / 4, CORRIDOR_HEIGHT / 2)

    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(CORRIDOR_WIDTH / 2, length / 4)

    b.wrapS = b.wrapT = THREE.RepeatWrapping
    b.repeat.set(length / 2, 1)

    return [w, c, b]
  }, [wallTex, ceilingTex, baseboardTex, length])

  // Floor tile constants — matching itomdev
  const TILE_LENGTH  = 10
  const CENTER_WIDTH = 5
  const SIDE_WIDTH   = 1
  const FLOOR_OFFSET = 2
  const uvFraction   = SIDE_WIDTH / CENTER_WIDTH   // 0.2

  const leftSideTex = useMemo(() => {
    const t = floorTex.clone(); t.needsUpdate = true
    t.repeat.set(1, uvFraction); t.offset.set(0, 0)
    return t
  }, [floorTex, uvFraction])

  const rightSideTex = useMemo(() => {
    const t = floorTex.clone(); t.needsUpdate = true
    t.repeat.set(1, uvFraction); t.offset.set(0, 1 - uvFraction)
    return t
  }, [floorTex, uvFraction])

  // Generate floor tiles for this segment
  const floorTiles = useMemo(() => {
    const tiles: React.ReactElement[] = []
    const endZ   = zStart - length
    const firstI = Math.floor(zStart / TILE_LENGTH)
    let tileZ    = firstI * TILE_LENGTH - TILE_LENGTH / 2 + FLOOR_OFFSET

    while (tileZ + TILE_LENGTH / 2 > endZ) {
      const idx       = Math.round(tileZ / TILE_LENGTH)
      const mirrored  = Math.abs(idx) % 2 === 1
      const rot: [number, number, number] = [-Math.PI / 2, 0, Math.PI / 2 + (mirrored ? Math.PI : 0)]
      const scaleX    = mirrored ? -1 : 1

      tiles.push(
        // Center strip
        <mesh key={`fc-${tileZ.toFixed(1)}`} position={[0, FLOOR_Y, tileZ]} rotation={rot} scale={[scaleX, 1, 1]}>
          <planeGeometry args={[TILE_LENGTH, CENTER_WIDTH]} />
          <meshBasicMaterial color="#e0e0e0" map={floorTex} side={THREE.DoubleSide} />
        </mesh>,
        // Left strip
        <mesh key={`fl-${tileZ.toFixed(1)}`} position={[-(CENTER_WIDTH / 2 + SIDE_WIDTH / 2), FLOOR_Y, tileZ]} rotation={rot} scale={[scaleX, 1, 1]}>
          <planeGeometry args={[TILE_LENGTH, SIDE_WIDTH]} />
          <meshBasicMaterial color="#e0e0e0" map={leftSideTex} side={THREE.DoubleSide} />
        </mesh>,
        // Right strip
        <mesh key={`fr-${tileZ.toFixed(1)}`} position={[(CENTER_WIDTH / 2 + SIDE_WIDTH / 2), FLOOR_Y, tileZ]} rotation={rot} scale={[scaleX, 1, 1]}>
          <planeGeometry args={[TILE_LENGTH, SIDE_WIDTH]} />
          <meshBasicMaterial color="#e0e0e0" map={rightSideTex} side={THREE.DoubleSide} />
        </mesh>
      )
      tileZ -= TILE_LENGTH
    }
    return tiles
  }, [zStart, length, floorTex, leftSideTex, rightSideTex])

  const centerZ = zStart - length / 2

  // Point lights every 15 units
  const lights = useMemo(() => {
    const count = Math.ceil(length / 15)
    return Array.from({ length: count }, (_, i) => zStart - 5 - i * 15)
  }, [zStart, length])

  return (
    <group>
      {/* Floor — 3-strip tiled */}
      {floorTiles}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_Y, centerZ]}>
        <planeGeometry args={[CORRIDOR_WIDTH, length]} />
        <meshBasicMaterial map={ct} color="#e8e4dc" />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[length, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wt} color="#e0ddd4" />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[length, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wt} color="#e0ddd4" />
      </mesh>

      {/* Baseboard left */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2 + 0.02, FLOOR_Y + 0.06, centerZ]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial map={bt} color="#c8c4b0" />
      </mesh>

      {/* Baseboard right */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2 - 0.02, FLOOR_Y + 0.06, centerZ]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial map={bt} color="#c8c4b0" />
      </mesh>

      <ambientLight intensity={0.9} color="#f0ebe0" />

      {lights.map(z => (
        <pointLight key={z} position={[0, 1.5, z]} intensity={1.2} color="#fff3dc" distance={25} decay={2} />
      ))}
    </group>
  )
}
