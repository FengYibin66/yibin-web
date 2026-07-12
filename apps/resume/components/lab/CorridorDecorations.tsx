'use client'

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useTexture, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import '@/components/lab/shaders/RevealMaterial'

// ── Constants ─────────────────────────────────────────────────────────────────

const WALL_X       = 3.49   // half corridor width - epsilon
const FLOOR_Y      = -1.75
const CEIL_Y       =  1.75
const CABIN_SKETCH = '/fonts/CabinSketch-Regular.ttf'

// Pre-allocated vectors for useFrame (avoid per-frame GC allocations)
const _pos   = new THREE.Vector3()
const _rot   = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _dir   = new THREE.Vector3()
const _euler = new THREE.Euler()
const _quat  = new THREE.Quaternion()

// ── PictureContent ────────────────────────────────────────────────────────────

interface PictureContentProps {
  imagePath: string
  imagePaintedPath?: string
  width: number
  height: number
  isPainted: boolean
}

function PictureContent({ imagePath, imagePaintedPath, width, height, isPainted }: PictureContentProps) {
  const tex        = useTexture(imagePath)
  const paintedTex = useTexture(imagePaintedPath ?? imagePath)
  const matRef     = useRef<{ uProgress: number } | null>(null)

  useEffect(() => {
    if (!matRef.current || !imagePaintedPath) return
    gsap.to(matRef.current, {
      uProgress: isPainted ? 1.0 : 0.0,
      duration:  isPainted ? 0.8 : 0.5,
      ease: 'power2.out',
      overwrite: true,
    })
  }, [isPainted, imagePaintedPath])

  return (
    <group position={[0, 0, 0.01]}>
      {imagePaintedPath && (
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={paintedTex} transparent alphaTest={0.5} color="#e0e0e0" side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh>
        <planeGeometry args={[width, height]} />
        {imagePaintedPath ? (
          // @ts-expect-error revealMaterial registered via extend()
          <revealMaterial ref={matRef} map={tex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} uProgress={0} />
        ) : (
          <meshBasicMaterial map={tex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
        )}
      </mesh>
    </group>
  )
}

// ── InspectableFrame ──────────────────────────────────────────────────────────

interface FrameDef {
  id: string
  side: 'left' | 'right'
  z: number
  y?: number
  width: number
  height: number
  offsetFromWall?: number
  image?: string
  imagePainted?: string
  imageWidth?: number
  imageHeight?: number
  signature?: string
  signatureX?: number
  signatureY?: number
  signatureSize?: number
  signatureColor?: string
}

interface InspectableFrameProps {
  frame: FrameDef
  frameTexture: THREE.Texture
  framePaintedTexture: THREE.Texture
  setCameraOverride?: (active: boolean) => void
}

function InspectableFrame({ frame, frameTexture, framePaintedTexture, setCameraOverride }: InspectableFrameProps) {
  const { camera, viewport } = useThree()
  const groupRef        = useRef<THREE.Group>(null)
  const frameMatRef     = useRef<{ uProgress: number } | null>(null)
  const framePaintedRef = useRef<THREE.Mesh>(null)
  const hideDelayRef    = useRef<gsap.core.Tween | null>(null)
  const compileRef      = useRef(0)

  const [isHovered,   setIsHovered]   = useState(false)
  const [isInspected, setIsInspected] = useState(false)

  const offsetX  = frame.offsetFromWall ?? 0
  const originX  = frame.side === 'left' ? -WALL_X + offsetX : WALL_X - offsetX
  const originPos = useMemo(() => new THREE.Vector3(originX, frame.y ?? 0, frame.z), [originX, frame.y, frame.z])
  const originRot = useMemo(() => new THREE.Euler(0, frame.side === 'left' ? Math.PI / 2 : -Math.PI / 2, 0), [frame.side])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInspected && setCameraOverride) setCameraOverride(false)
    }
  }, [isInspected, setCameraOverride])

  // RevealMaterial sync
  useEffect(() => {
    if (!frameMatRef.current) return
    const on = isHovered || isInspected
    if (on) {
      if (hideDelayRef.current) hideDelayRef.current.kill()
      if (framePaintedRef.current) framePaintedRef.current.visible = true
      gsap.to(frameMatRef.current, { uProgress: 1.0, duration: 0.8, ease: 'power2.out', overwrite: true })
    } else {
      gsap.to(frameMatRef.current, { uProgress: 0.0, duration: 0.5, ease: 'power2.out', overwrite: true })
      hideDelayRef.current = gsap.delayedCall(0.55, () => {
        if (framePaintedRef.current) framePaintedRef.current.visible = false
      })
    }
    return () => { hideDelayRef.current?.kill() }
  }, [isHovered, isInspected])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Lazy-hide painted layer after 2 compile frames
    if (compileRef.current < 2) {
      compileRef.current++
      if (compileRef.current === 2 && !isHovered && !isInspected) {
        if (framePaintedRef.current) framePaintedRef.current.visible = false
      }
    }

    if (isInspected) {
      camera.getWorldDirection(_dir)
      const aspectOffset = Math.max(0, 1.8 - viewport.aspect) * 1.5
      const dist = Math.min(2.8, Math.max(1.5, 1.3 + aspectOffset))
      _pos.copy(camera.position).add(_dir.multiplyScalar(dist))
      _rot.copy(camera.quaternion)
      _euler.set(-state.pointer.y * 0.3, state.pointer.x * 0.3, 0)
      _quat.setFromEuler(_euler)
      _rot.multiply(_quat)
      _scale.set(1.2, 1.2, 1.2)
    } else {
      _pos.copy(originPos)
      _rot.setFromEuler(originRot)
      _scale.set(1, 1, 1)
    }

    const f = delta * 6
    groupRef.current.position.lerp(_pos, f)
    groupRef.current.quaternion.slerp(_rot, f)
    groupRef.current.scale.lerp(_scale, f)
  })

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setIsInspected(prev => {
      const next = !prev
      if (setCameraOverride) setCameraOverride(next)
      return next
    })
    setIsHovered(false)
  }, [setCameraOverride])

  return (
    <group ref={groupRef} position={originPos} rotation={originRot}>
      {/* Invisible hitbox */}
      <mesh
        position={[0, 0, 0.05]}
        onClick={handleClick}
        onPointerEnter={(e) => { e.stopPropagation(); if (!isInspected) setIsHovered(true) }}
        onPointerLeave={(e) => { e.stopPropagation(); setIsHovered(false) }}
      >
        <planeGeometry args={[frame.width, frame.height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Painted frame (behind sketch) — starts hidden, shown on hover */}
      <mesh ref={framePaintedRef} position={[0, 0, -0.001]} scale={[0.98, 0.98, 1]} visible={false}>
        <planeGeometry args={[frame.width, frame.height]} />
        <meshBasicMaterial map={framePaintedTexture} transparent alphaTest={0.5} color="#e0e0e0" side={THREE.DoubleSide} />
      </mesh>

      {/* Sketch frame with RevealMaterial */}
      <mesh>
        <planeGeometry args={[frame.width, frame.height]} />
        {/* @ts-expect-error revealMaterial registered via extend() */}
        <revealMaterial ref={frameMatRef} map={frameTexture} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} uProgress={0} />
      </mesh>

      {/* Picture content */}
      {frame.image && (
        <PictureContent
          imagePath={frame.image}
          imagePaintedPath={frame.imagePainted}
          width={frame.imageWidth  ?? frame.width  * 0.7}
          height={frame.imageHeight ?? frame.height * 0.7}
          isPainted={isHovered || isInspected}
        />
      )}

      {/* Signature text (for empty frames) */}
      {frame.signature && (
        <Text
          position={[
            frame.signatureX ?? 0,
            frame.signatureY ?? 0,
            0.02,
          ]}
          fontSize={frame.signatureSize ?? 0.12}
          font={CABIN_SKETCH}
          color={frame.signatureColor ?? '#333333'}
          anchorX="center"
          anchorY="middle"
          maxWidth={frame.width * 0.8}
          textAlign="center"
        >
          {frame.signature}
        </Text>
      )}
    </group>
  )
}

// ── CeilingLamp ───────────────────────────────────────────────────────────────

function CeilingLamp({ z }: { z: number }) {
  const grilleTex = useTexture('/textures/corridor/kratanalampy.webp')
  const sideTex   = useTexture('/textures/corridor/bokilampy.webp')

  grilleTex.wrapS = grilleTex.wrapT = THREE.ClampToEdgeWrapping
  sideTex.wrapS   = sideTex.wrapT   = THREE.ClampToEdgeWrapping

  return (
    <group position={[0, CEIL_Y, z]}>
      {/* 3D lamp housing — boxGeometry matching itomdev */}
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[2.0, 0.06, 0.5]} />
        <meshBasicMaterial attach="material-0" color="#e8e8e8" />
        <meshBasicMaterial attach="material-1" color="#e8e8e8" />
        <meshBasicMaterial attach="material-2" color="#d0d0d0" />
        <meshBasicMaterial attach="material-3" map={grilleTex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
        <meshBasicMaterial attach="material-4" map={sideTex} color="#e0e0e0" />
        <meshBasicMaterial attach="material-5" map={sideTex} color="#e0e0e0" />
      </mesh>
      {/* Inner glow panel */}
      <mesh position={[0, -0.059, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.9, 0.4]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Desk ─────────────────────────────────────────────────────────────────────

function Desk({ z }: { z: number }) {
  const woodTex     = useTexture('/textures/corridor/texturadrewnadonozekbiurka.webp')
  const tableTopTex = useTexture('/textures/corridor/gorastolika.webp')
  const flowerTex   = useTexture('/textures/corridor/kwiatekwdoniczce.webp')

  const legTex = useMemo(() => {
    const t = woodTex.clone()
    t.needsUpdate = true
    t.rotation = Math.PI / 2
    t.center.set(0.5, 0.5)
    return t
  }, [woodTex])

  const W = 2.0   // width along wall
  const D = 0.8   // depth into corridor
  const H = 1.0   // total height
  const LEG = 0.08
  const TOP = 0.08

  return (
    <group position={[-WALL_X + 0.42, FLOOR_Y, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* 4 legs */}
      {([
        [-W / 2 + 0.1, -D / 2 + 0.1],
        [ W / 2 - 0.1, -D / 2 + 0.1],
        [-W / 2 + 0.1,  D / 2 - 0.1],
        [ W / 2 - 0.1,  D / 2 - 0.1],
      ] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, H / 2, lz]}>
          <boxGeometry args={[LEG * 2, H, LEG * 2]} />
          <meshBasicMaterial color="#e0e0e0" map={legTex} />
        </mesh>
      ))}
      {/* Tabletop */}
      <mesh position={[0, H + TOP / 2, 0]}>
        <boxGeometry args={[W, TOP, D]} />
        <meshBasicMaterial attach="material-0" color="#e0e0e0" map={woodTex} />
        <meshBasicMaterial attach="material-1" color="#e0e0e0" map={woodTex} />
        <meshBasicMaterial attach="material-2" color="#e0e0e0" map={tableTopTex} />
        <meshBasicMaterial attach="material-3" color="#e0e0e0" />
        <meshBasicMaterial attach="material-4" color="#e0e0e0" map={woodTex} />
        <meshBasicMaterial attach="material-5" color="#e0e0e0" map={woodTex} />
      </mesh>
      {/* Flower pot on desk */}
      <mesh position={[0, H + TOP + 0.2, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <planeGeometry args={[0.3, 0.3 / 0.758]} />
        <meshBasicMaterial map={flowerTex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Cabinet ───────────────────────────────────────────────────────────────────

function Cabinet({ z }: { z: number }) {
  const frontTex = useTexture('/textures/corridor/szafkaprzod.webp')
  const restTex  = useTexture('/textures/corridor/szafkaprzodgora.webp')
  const frameTex = useTexture('/textures/corridor/ramkanazdjeciemala.webp')

  return (
    <group>
      {/* Cabinet box */}
      <mesh position={[WALL_X - 0.26, FLOOR_Y + 0.5, z]}>
        <boxGeometry args={[0.5, 1.0, 0.8]} />
        <meshBasicMaterial attach="material-0" map={restTex}  color="#e0e0e0" />
        <meshBasicMaterial attach="material-1" map={frontTex} color="#e0e0e0" />
        <meshBasicMaterial attach="material-2" map={restTex}  color="#e0e0e0" />
        <meshBasicMaterial attach="material-3" map={restTex}  color="#e0e0e0" />
        <meshBasicMaterial attach="material-4" map={restTex}  color="#e0e0e0" />
        <meshBasicMaterial attach="material-5" map={restTex}  color="#e0e0e0" />
      </mesh>
      {/* Standing photo frame on top */}
      <mesh
        position={[WALL_X - 0.26, FLOOR_Y + 1.0 + 0.2, z]}
        rotation={[0, -Math.PI / 2 + 0.2, 0]}
      >
        <planeGeometry args={[0.3, 0.3 / 0.777]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── VentGrate ─────────────────────────────────────────────────────────────────

function VentGrate({ side, z }: { side: 'left' | 'right'; z: number }) {
  const tex  = useTexture('/textures/corridor/kratkawentylacyjna.webp')
  const x    = side === 'left' ? -WALL_X + 0.01 : WALL_X - 0.01
  const rotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2

  return (
    <mesh position={[x, CEIL_Y - 0.6, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[0.8, 0.8 / 1.968]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── PottedTree ────────────────────────────────────────────────────────────────

function PottedTree({ z }: { z: number }) {
  const tex = useTexture('/textures/corridor/drzewkowdoniczce.webp')
  return (
    <mesh position={[-WALL_X + 0.8, FLOOR_Y + 1.5, z]} rotation={[0, Math.PI / 4, 0]}>
      <planeGeometry args={[1.8, 1.8 / 0.602]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CorridorDecorationsProps {
  /** Z coordinate of segment start (camera-facing end) */
  zOffset: number
  setCameraOverride?: (active: boolean) => void
}

export function CorridorDecorations({ zOffset, setCameraOverride }: CorridorDecorationsProps) {
  const frameTexture        = useTexture('/textures/corridor/ramkanazdjecieduza.webp')
  const framePaintedTexture = useTexture('/textures/corridor/ramkanazdjecieduza_painted.webp')

  // Lamp positions: every 15 units from zOffset-5
  const lampZs = useMemo(() => {
    const zs: number[] = []
    for (let z = zOffset - 5; z > zOffset - 90; z -= 15) zs.push(z)
    return zs
  }, [zOffset])

  // Frame definitions — matching itomdev layout
  const frames = useMemo<FrameDef[]>(() => [
    {
      id: 'f1', side: 'right', z: zOffset - 10, y: 0.3,
      width: 2.5, height: 2.5 / 1.785,
      image: '/textures/corridor/rysuneknaobraz1.webp',
      imageWidth: 1.1, imageHeight: 1.1,
      offsetFromWall: 0.1,
    },
    {
      id: 'f2', side: 'left', z: zOffset - 25, y: 0.2,
      width: 2.5, height: 2.5 / 1.785,
      image: '/textures/corridor/rysuneknaobrazek3.webp',
      imageWidth: 1.7, imageHeight: 1.0,
      offsetFromWall: 0.1,
    },
    {
      id: 'f3', side: 'right', z: zOffset - 40, y: 0.25,
      width: 2.5, height: 2.5 / 1.785,
      signature: 'Empty canvas!\nWant your art here?\nContact me!',
      signatureX: 0, signatureY: 0, signatureSize: 0.12, signatureColor: '#333333',
    },
    {
      id: 'f4', side: 'left', z: zOffset - 55, y: 0.35,
      width: 2.5, height: 2.5 / 1.785,
      signature: 'Empty canvas!\nWant your art here?\nContact me!',
      signatureX: 0, signatureY: 0, signatureSize: 0.12, signatureColor: '#333333',
    },
  ], [zOffset])

  return (
    <group>
      {/* Ceiling lamps */}
      {lampZs.map(z => <CeilingLamp key={z} z={z} />)}

      {/* Picture frames */}
      {frames.map(frame => (
        <InspectableFrame
          key={frame.id}
          frame={frame}
          frameTexture={frameTexture}
          framePaintedTexture={framePaintedTexture}
          setCameraOverride={setCameraOverride}
        />
      ))}

      {/* Ventilation grates — opposite wall from each frame */}
      {frames.map(frame => (
        <VentGrate
          key={`grate-${frame.id}`}
          side={frame.side === 'left' ? 'right' : 'left'}
          z={frame.z}
        />
      ))}

      {/* Desk + flower: left wall, between door relZ=-20 and relZ=-32 */}
      <Desk z={zOffset - 27} />

      {/* Cabinet + frame: right wall, between door relZ=-44 and relZ=-56 */}
      <Cabinet z={zOffset - 49} />

      {/* Potted tree: left wall, after last door relZ=-56 */}
      <PottedTree z={zOffset - 63} />
    </group>
  )
}
