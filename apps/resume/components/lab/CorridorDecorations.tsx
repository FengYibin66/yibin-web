'use client'

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useTexture, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import '@/components/lab/shaders/RevealMaterial'
import { getCorridorMurals, fitMuralSize } from '@/lib/lab/corridorMurals'

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

      {/* Signature — empty frames always; photo murals only while inspected */}
      {frame.signature && (!frame.image || isInspected) ? (
        <Text
          position={[
            frame.signatureX ?? 0,
            frame.image && isInspected ? 0 : (frame.signatureY ?? 0),
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
      ) : null}
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
  const photoTex = useTexture('/gallery/life/beloved.jpg')

  useEffect(() => {
    photoTex.colorSpace = THREE.SRGBColorSpace
  }, [photoTex])

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
      {/* Standing photo frame on top — small personal photo */}
      <group position={[WALL_X - 0.26, FLOOR_Y + 1.0 + 0.22, z]} rotation={[0, -Math.PI / 2 + 0.2, 0]}>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[0.32, 0.32 / 0.777]} />
          <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} color="#e0e0e0" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.01, 0.005]}>
          <planeGeometry args={[0.2, 0.26]} />
          <meshBasicMaterial map={photoTex} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
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

// ── Adaptive museum mural (fixed preferred width, height follows aspect) ──────

interface AdaptiveMuralFrameProps {
  mural: {
    id: string
    side: 'left' | 'right'
    z: number
    y: number
    preferredWidth: number
    offsetFromWall: number
    image: string
    aspect: number
    signature: string
  }
  setCameraOverride?: (active: boolean) => void
}

/**
 * Museum-style frame: photo is full-bleed inside a slim matte.
 * Width prefers `preferredWidth`; height = width / aspect (clamped to corridor).
 * No letterboxed empty area inside the picture.
 */
function AdaptiveMuralFrame({ mural, setCameraOverride }: AdaptiveMuralFrameProps) {
  const { camera, viewport } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const tex = useTexture(mural.image)

  const [isHovered, setIsHovered] = useState(false)
  const [isInspected, setIsInspected] = useState(false)

  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
  }, [tex])

  const liveAspect = useMemo(() => {
    const iw = tex.image?.width
    const ih = tex.image?.height
    if (typeof iw === 'number' && typeof ih === 'number' && iw > 0 && ih > 0) {
      return iw / ih
    }
    return mural.aspect
  }, [tex.image, mural.aspect])

  const { width, height } = useMemo(
    () => fitMuralSize(liveAspect, mural.preferredWidth),
    [liveAspect, mural.preferredWidth],
  )

  // Slim matte around the photo (~4.5%)
  const matte = Math.min(width, height) * 0.045
  const outerW = width + matte * 2
  const outerH = height + matte * 2

  const offsetX = mural.offsetFromWall
  const originX = mural.side === 'left' ? -WALL_X + offsetX : WALL_X - offsetX
  const originPos = useMemo(
    () => new THREE.Vector3(originX, mural.y, mural.z),
    [originX, mural.y, mural.z],
  )
  const originRot = useMemo(
    () => new THREE.Euler(0, mural.side === 'left' ? Math.PI / 2 : -Math.PI / 2, 0),
    [mural.side],
  )

  useEffect(() => {
    return () => {
      if (isInspected && setCameraOverride) setCameraOverride(false)
    }
  }, [isInspected, setCameraOverride])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    if (isInspected) {
      camera.getWorldDirection(_dir)
      const aspectOffset = Math.max(0, 1.8 - viewport.aspect) * 1.5
      const dist = Math.min(2.8, Math.max(1.5, 1.3 + aspectOffset))
      _pos.copy(camera.position).add(_dir.multiplyScalar(dist))
      _rot.copy(camera.quaternion)
      _euler.set(-state.pointer.y * 0.25, state.pointer.x * 0.25, 0)
      _quat.setFromEuler(_euler)
      _rot.multiply(_quat)
      _scale.set(1.15, 1.15, 1.15)
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

  const rimBoost = isHovered || isInspected ? 1.08 : 1

  return (
    <group ref={groupRef} position={originPos} rotation={originRot}>
      {/* Hitbox */}
      <mesh
        position={[0, 0, 0.06]}
        onClick={handleClick}
        onPointerEnter={(e) => { e.stopPropagation(); if (!isInspected) setIsHovered(true) }}
        onPointerLeave={(e) => { e.stopPropagation(); setIsHovered(false) }}
      >
        <planeGeometry args={[outerW, outerH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Soft shadow plate */}
      <mesh position={[0.02, -0.03, -0.02]}>
        <planeGeometry args={[outerW * 1.02, outerH * 1.02]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Outer wood rim */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[outerW * rimBoost, outerH * rimBoost]} />
        <meshBasicMaterial color={isHovered || isInspected ? '#5c4030' : '#3d2b1f'} side={THREE.DoubleSide} />
      </mesh>

      {/* Cream matte */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[outerW - 0.04, outerH - 0.04]} />
        <meshBasicMaterial color="#f3eee6" side={THREE.DoubleSide} />
      </mesh>

      {/* Full-bleed photo — no empty letterbox */}
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Hover accent line */}
      {(isHovered || isInspected) && (
        <mesh position={[0, -outerH / 2 - 0.04, 0.02]}>
          <planeGeometry args={[Math.min(outerW * 0.45, 0.9), 0.012]} />
          <meshBasicMaterial color="#00d4ff" toneMapped={false} />
        </mesh>
      )}

      {isInspected ? (
        <Text
          position={[0, -outerH / 2 - 0.18, 0.03]}
          fontSize={0.09}
          font={CABIN_SKETCH}
          color="#2a2a2a"
          anchorX="center"
          anchorY="top"
          maxWidth={outerW * 1.1}
          textAlign="center"
        >
          {mural.signature}
        </Text>
      ) : null}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CorridorDecorationsProps {
  /** Z coordinate of segment start (camera-facing end) */
  zOffset: number
  /** Used to rotate Gallery mural heroes across infinite segments */
  segmentIndex?: number
  setCameraOverride?: (active: boolean) => void
}

export function CorridorDecorations({
  zOffset,
  segmentIndex = 0,
  setCameraOverride,
}: CorridorDecorationsProps) {
  // Lamp positions: every 15 units from zOffset-5
  const lampZs = useMemo(() => {
    const zs: number[] = []
    for (let z = zOffset - 5; z > zOffset - 90; z -= 15) zs.push(z)
    return zs
  }, [zOffset])

  const murals = useMemo(
    () =>
      getCorridorMurals(segmentIndex).map(m => ({
        ...m,
        z: zOffset + m.relativeZ,
      })),
    [zOffset, segmentIndex],
  )

  return (
    <group>
      {lampZs.map(z => <CeilingLamp key={z} z={z} />)}

      {murals.map(mural => (
        <AdaptiveMuralFrame
          key={`${mural.id}-${segmentIndex}`}
          mural={mural}
          setCameraOverride={setCameraOverride}
        />
      ))}

      {murals.map(mural => (
        <VentGrate
          key={`grate-${mural.id}-${segmentIndex}`}
          side={mural.side === 'left' ? 'right' : 'left'}
          z={mural.z}
        />
      ))}

      <Desk z={zOffset - 27} />
      <Cabinet z={zOffset - 49} />
      <PottedTree z={zOffset - 63} />
    </group>
  )
}
