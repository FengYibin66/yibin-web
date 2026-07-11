'use client'

import { useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import { Cat } from '@/components/lab/Cat'
import '@/components/lab/shaders/RevealMaterial'
import * as THREE from 'three'
import gsap from 'gsap'

const FLOOR_Y       = -1.75
const DOOR_WIDTH    = 0.94
const DOOR_HEIGHT   = 2.4
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2  // -0.55

const DUCK_QUOTES = [
  "Have you tried console.log()?",
  "Did you clear the cache?",
  "It works on my machine!",
  "Have you turned it off and on again?",
  "Maybe it's a CSS issue?",
  "Check for missing semicolons!",
  "Did you read the error message?",
  "Have you tried Stack Overflow?",
  "Is it plugged in?",
  "Works in production! 🚀",
]

function BrickScene({ onEntered }: { onEntered: () => void }) {
  const brickTex        = useTexture('/textures/entrance/wall_bricks_2.webp')
  const floorTex        = useTexture('/textures/entrance/floor_paper.webp')
  const treeTex         = useTexture('/textures/entrance/tree_sketch.webp')
  const mouseTex        = useTexture('/textures/entrance/mouse_hanging.webp')
  const winTex          = useTexture('/textures/entrance/window_sketch.webp')
  const avatarTex       = useTexture('/textures/entrance/avatar_window.webp')
  const potTex          = useTexture('/textures/entrance/pot_with_duck.webp')
  const pathTex         = useTexture('/textures/entrance/stone-path.webp')
  const signTex         = useTexture('/textures/entrance/sign.webp')
  const speechTex       = useTexture('/textures/entrance/speech_bubble.webp')
  const frameTex        = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  // Sketch (black-and-white) + painted (colour) for RevealMaterial brush-stroke hover
  const doorSketchTex   = useTexture('/textures/corridor/doors/drzwiabout.webp')
  const doorPaintedTex  = useTexture('/textures/corridor/doors/drzwiabout_painted.webp')
  const handleSketchTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const handlePaintedTex= useTexture('/textures/corridor/doors/klamkadodrzwi_painted.webp')
  const bugTex          = useTexture('/textures/entrance/bug_sketch.webp')
  const inkTex          = useTexture('/textures/corridor/ink_splash.webp')

  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(6, 6)
  pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping
  pathTex.repeat.set(1, 2)

  // ─── Door / handle refs ─────────────────────────────────────────────────────
  const leftRef    = useRef<THREE.Group>(null)
  const rightRef   = useRef<THREE.Group>(null)
  const leftHandleRef  = useRef<THREE.Group>(null)
  const rightHandleRef = useRef<THREE.Group>(null)
  const isOpenRef  = useRef(false)
  const { camera } = useThree()

  // RevealMaterial refs (GLSL uProgress brush-stroke discard)
  const leftRevealRef   = useRef<{ uProgress: number } | null>(null)
  const rightRevealRef  = useRef<{ uProgress: number } | null>(null)
  const lHandleRevealRef= useRef<{ uProgress: number } | null>(null)
  const rHandleRevealRef= useRef<{ uProgress: number } | null>(null)
  const lHandlePaintedRef = useRef<THREE.Mesh>(null)
  const rHandlePaintedRef = useRef<THREE.Mesh>(null)
  const hideDelayRef    = useRef<gsap.core.Tween | null>(null)

  // ─── Window avatar ──────────────────────────────────────────────────────────
  const avatarRef  = useRef<THREE.Mesh>(null)

  // ─── Mouse pendulum ─────────────────────────────────────────────────────────
  const mouseRef   = useRef<THREE.Group>(null)

  // ─── Duck speech bubble ─────────────────────────────────────────────────────
  const speechRef     = useRef<THREE.Group>(null)
  const [duckQuote, setDuckQuote]     = useState('')
  const [duckSpeaking, setDuckSpeaking] = useState(false)

  // ─── Entrance bug easter egg ─────────────────────────────────────────────────
  const bugRef        = useRef<THREE.Mesh>(null)
  const inkRef        = useRef<THREE.Mesh>(null)
  const bugClickPos   = useRef({ x: 0, y: 0 })
  const [bugClicked, setBugClicked]   = useState(false)
  const [bugClipProg, setBugClipProg] = useState(0)

  useFrame((state) => {
    if (!mouseRef.current) return
    mouseRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.12

    // Bug wandering
    if (!bugClicked && bugRef.current) {
      const t = state.clock.elapsedTime
      const xOff = Math.sin(t * 0.8) * 0.3 + Math.sin(t * 1.5) * 0.1
      const yOff = Math.cos(t * 0.6) * 0.2 + Math.cos(t * 1.1) * 0.1
      bugRef.current.position.x = 2.5 + xOff
      bugRef.current.position.y = (FLOOR_Y + 2.8) + yOff
      bugRef.current.rotation.z = Math.sin(t * 5) * 0.1 + Math.atan2(yOff, xOff) * 0.2
    }
  })

  // ─── Hover handlers — micro-open + RevealMaterial ───────────────────────────
  const handlePointerEnter = useCallback(() => {
    if (isOpenRef.current) return
    // Doors crack open slightly
    gsap.to(leftRef.current!.rotation,  { y: -0.08, duration: 0.3, ease: 'power2.out', overwrite: true })
    gsap.to(rightRef.current!.rotation, { y:  0.08, duration: 0.3, ease: 'power2.out', overwrite: true })
    // Handle hint
    if (leftHandleRef.current)  gsap.to(leftHandleRef.current.rotation,  { z:  0.1, duration: 0.2, ease: 'power2.out', overwrite: true })
    if (rightHandleRef.current) gsap.to(rightHandleRef.current.rotation, { z: -0.1, duration: 0.2, ease: 'power2.out', overwrite: true })
    // Brush-stroke sketch→painted reveal
    for (const r of [leftRevealRef, rightRevealRef, lHandleRevealRef, rHandleRevealRef]) {
      if (r.current) gsap.to(r.current, { uProgress: 1.0, duration: 0.8, ease: 'power2.out', overwrite: true })
    }
    if (hideDelayRef.current) hideDelayRef.current.kill()
    if (lHandlePaintedRef.current) lHandlePaintedRef.current.visible = true
    if (rHandlePaintedRef.current) rHandlePaintedRef.current.visible = true
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (isOpenRef.current) return
    gsap.to(leftRef.current!.rotation,  { y: 0, duration: 0.3, ease: 'power2.out', overwrite: true })
    gsap.to(rightRef.current!.rotation, { y: 0, duration: 0.3, ease: 'power2.out', overwrite: true })
    if (leftHandleRef.current)  gsap.to(leftHandleRef.current.rotation,  { z: 0, duration: 0.2, ease: 'power2.out', overwrite: true })
    if (rightHandleRef.current) gsap.to(rightHandleRef.current.rotation, { z: 0, duration: 0.2, ease: 'power2.out', overwrite: true })
    for (const r of [leftRevealRef, rightRevealRef, lHandleRevealRef, rHandleRevealRef]) {
      if (r.current) gsap.to(r.current, { uProgress: 0.0, duration: 0.5, ease: 'power2.out', overwrite: true })
    }
    hideDelayRef.current = gsap.delayedCall(0.55, () => {
      if (lHandlePaintedRef.current) lHandlePaintedRef.current.visible = false
      if (rHandlePaintedRef.current) rHandlePaintedRef.current.visible = false
    })
  }, [])

  // ─── Bug click: ink splash + "BUG FIXED!" reveal ────────────────────────────
  const handleBugClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (bugClicked) return
    if (bugRef.current) {
      bugClickPos.current = { x: bugRef.current.position.x, y: bugRef.current.position.y }
    }
    setBugClicked(true)

    if (inkRef.current) {
      inkRef.current.position.x = bugClickPos.current.x
      inkRef.current.position.y = bugClickPos.current.y
      inkRef.current.scale.set(0, 0, 1)
      gsap.to(inkRef.current.scale, { x: 0.8, y: 0.8, z: 1, duration: 0.4, ease: 'back.out(1.7)' })
    }

    const proxy = { progress: 0 }
    gsap.to(proxy, {
      progress: 1,
      duration: 0.8,
      ease: 'power1.inOut',
      onUpdate() { setBugClipProg(proxy.progress) },
    })
  }, [bugClicked])

  // ─── Click: full open + camera fly-in ───────────────────────────────────────
  const handleClick = useCallback(() => {
    if (isOpenRef.current) return
    isOpenRef.current = true
    if (leftHandleRef.current)  gsap.to(leftHandleRef.current.rotation,  { z:  0.4, duration: 0.15, ease: 'power2.out' })
    if (rightHandleRef.current) gsap.to(rightHandleRef.current.rotation, { z: -0.4, duration: 0.15, ease: 'power2.out' })
    gsap.to(leftRef.current!.rotation,  { y: -Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(rightRef.current!.rotation, { y:  Math.PI * 0.55, duration: 0.9, ease: 'power2.inOut' })
    gsap.to(camera.position, { z: 10, y: 0.2, duration: 1.8, ease: 'power2.inOut', delay: 0.3, onComplete: onEntered })
  }, [camera, onEntered])

  // ─── Window hover ────────────────────────────────────────────────────────────
  const handleWinEnter = useCallback(() => {
    if (!avatarRef.current) return
    gsap.to(avatarRef.current.position, { x: 2.5, duration: 0.5, ease: 'back.out(1.7)', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0.1, duration: 0.5, ease: 'power2.out',    overwrite: true })
  }, [])
  const handleWinLeave = useCallback(() => {
    if (!avatarRef.current) return
    gsap.to(avatarRef.current.position, { x: 4.0, duration: 0.4, ease: 'power2.in', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0,   duration: 0.4, ease: 'power2.in', overwrite: true })
  }, [])

  // ─── Duck click — rubber duck debugging quotes ───────────────────────────────
  const handleDuckClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (duckSpeaking) return
    const q = DUCK_QUOTES[Math.floor(Math.random() * DUCK_QUOTES.length)]
    setDuckQuote(q)
    setDuckSpeaking(true)
    if (speechRef.current) {
      speechRef.current.scale.set(0, 0, 0)
      gsap.to(speechRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(1.7)' })
    }
    setTimeout(() => {
      if (speechRef.current) {
        gsap.to(speechRef.current.scale, {
          x: 0, y: 0, z: 0, duration: 0.2, ease: 'power2.in',
          onComplete: () => setDuckSpeaking(false),
        })
      } else {
        setDuckSpeaking(false)
      }
    }, 3000)
  }, [duckSpeaking])

  return (
    <group>
      <ambientLight intensity={1.5} color="#ffffff" />

      {/* Paper floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.005, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial map={floorTex} color="#e8e4dc" />
      </mesh>

      {/* Brick wall background */}
      <mesh position={[0, 0.5, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshBasicMaterial map={brickTex} />
      </mesh>

      {/* Stone path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.01, 1.5]}>
        <planeGeometry args={[2.4, 4]} />
        <meshBasicMaterial map={pathTex} transparent alphaTest={0.05} />
      </mesh>

      {/* Tree — left side, with hanging mouse */}
      <group position={[-2.9, 0.95, 1]}>
        <mesh>
          <planeGeometry args={[6, 8]} />
          <meshBasicMaterial map={treeTex} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
        <group ref={mouseRef} position={[0.34, -0.3, 0.05]}>
          <mesh position={[0, -0.3, 0]}>
            <planeGeometry args={[0.7, 0.9]} />
            <meshBasicMaterial map={mouseTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
        </group>
      </group>

      {/* Avatar — hidden outside wall at x=4, slides in on window hover */}
      <mesh ref={avatarRef} position={[4.0, 0, 0.09]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={avatarTex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>

      {/* Window — right side */}
      <mesh position={[2.5, 0, 0.1]} onPointerEnter={handleWinEnter} onPointerLeave={handleWinLeave}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={winTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* Pot with duck + speech bubble + duck hitbox */}
      <group position={[2.5, FLOOR_Y + 0.45, 0.4]}>
        <mesh>
          <planeGeometry args={[3, 1.8]} />
          <meshBasicMaterial map={potTex} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
        {/* Invisible duck hitbox */}
        <mesh position={[0.38, 0.1, 0.01]} onClick={handleDuckClick}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {/* Speech bubble with quote */}
        <group ref={speechRef} position={[0.9, 0.8, 0.1]} scale={[0, 0, 0]}>
          <mesh>
            <planeGeometry args={[1.8, 1.2]} />
            <meshBasicMaterial map={speechTex} transparent alphaTest={0.01} depthWrite={false} />
          </mesh>
          <Text position={[0, 0.08, 0.01]} fontSize={0.07} color="#1a1a1a" anchorX="center" anchorY="middle" maxWidth={1.4} textAlign="center">
            {duckQuote || ' '}
          </Text>
        </group>
      </group>

      {/* Sign above door */}
      <mesh position={[0, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.45, 0.12]}>
        <planeGeometry args={[2.2, 0.7]} />
        <meshBasicMaterial map={signTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* Door frame */}
      <mesh position={[0, DOOR_CENTER_Y, 0.12]}>
        <planeGeometry args={[DOOR_WIDTH * 2 + 0.3, DOOR_HEIGHT + 0.3]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left door — hinge at x=-DOOR_WIDTH, opens inward */}
      <group
        ref={leftRef}
        position={[-DOOR_WIDTH, DOOR_CENTER_Y, 0.13]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        {/* Painted base layer (always present, revealed as sketch fades) */}
        <mesh position={[DOOR_WIDTH / 2, 0, 0.085]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={doorPaintedTex} transparent alphaTest={0.3} />
        </mesh>
        {/* Sketch RevealMaterial overlay — brush-stroke discards on hover */}
        <mesh position={[DOOR_WIDTH / 2, 0, 0.09]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          {/* @ts-expect-error revealMaterial registered via extend() */}
          <revealMaterial ref={leftRevealRef} map={doorSketchTex} transparent alphaTest={0.3} depthWrite={false} uProgress={0} />
        </mesh>
        {/* Handle pivot — left door */}
        <group ref={leftHandleRef} position={[DOOR_WIDTH / 2 + 0.357, -0.099, 0.10]}>
          <mesh ref={lHandlePaintedRef} position={[-0.357, 0.099, -0.001]} visible={false}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={handlePaintedTex} transparent alphaTest={0.3} depthWrite={false} />
          </mesh>
          <mesh position={[-0.357, 0.099, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            {/* @ts-expect-error revealMaterial registered via extend() */}
            <revealMaterial ref={lHandleRevealRef} map={handleSketchTex} transparent alphaTest={0.3} depthWrite={false} uProgress={0} />
          </mesh>
        </group>
      </group>

      {/* Entrance bug easter egg — wanders above window, click to fix */}
      {!bugClicked && (
        <mesh ref={bugRef} position={[2.5, FLOOR_Y + 2.8, 0.16]} onClick={handleBugClick}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial map={bugTex} transparent alphaTest={0.01} depthWrite={false} />
        </mesh>
      )}
      {/* Ink splash — always mounted to preload, scaled to 0 until triggered */}
      <mesh ref={inkRef} position={[2.5, FLOOR_Y + 2.8, 0.17]} scale={[0, 0, 1]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={inkTex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>
      {/* "BUG FIXED!" revealed left-to-right */}
      {bugClicked && (
        <Text
          position={[bugClickPos.current.x, bugClickPos.current.y, 0.35]}
          fontSize={0.25}
          color="#1a1a1a"
          font="/fonts/CabinSketch-Bold.ttf"
          anchorX="center"
          anchorY="middle"
          clipRect={[-1, -0.5, -1 + bugClipProg * 2.5, 0.5]}
        >
          BUG FIXED!
        </Text>
      )}

      {/* Right door — hinge at x=+DOOR_WIDTH, opens inward */}
      <group ref={rightRef} position={[DOOR_WIDTH, DOOR_CENTER_Y, 0.13]} onClick={handleClick}>
        <mesh position={[-DOOR_WIDTH / 2, 0, 0.085]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={doorPaintedTex} transparent alphaTest={0.3} />
        </mesh>
        <mesh position={[-DOOR_WIDTH / 2, 0, 0.09]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          {/* @ts-expect-error revealMaterial registered via extend() */}
          <revealMaterial ref={rightRevealRef} map={doorSketchTex} transparent alphaTest={0.3} depthWrite={false} uProgress={0} />
        </mesh>
        {/* Handle pivot — right door */}
        <group ref={rightHandleRef} position={[-DOOR_WIDTH / 2 - 0.357, -0.099, 0.10]}>
          <mesh ref={rHandlePaintedRef} position={[0.357, 0.099, -0.001]} visible={false}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={handlePaintedTex} transparent alphaTest={0.3} depthWrite={false} />
          </mesh>
          <mesh position={[0.357, 0.099, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            {/* @ts-expect-error revealMaterial registered via extend() */}
            <revealMaterial ref={rHandleRevealRef} map={handleSketchTex} transparent alphaTest={0.3} depthWrite={false} uProgress={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function EntryCamera({ flying }: { flying: boolean }) {
  const { camera } = useThree()
  useFrame((state) => {
    if (flying) return
    const px = state.pointer.x
    const py = state.pointer.y
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.2, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.3 + py * 0.08, 0.04)
    camera.lookAt(px * 0.1, 0, -3)
  })
  return null
}

export interface EntryPreviewSceneProps { onEnter: () => void }

export function EntryPreviewScene({ onEnter }: EntryPreviewSceneProps) {
  const [flying, setFlying] = useState(false)
  return (
    <Canvas
      camera={{ position: [0, 0.3, 6], fov: 55, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <EntryCamera flying={flying} />
        <BrickScene onEntered={() => { setFlying(true); onEnter() }} />
        <Cat position={[-1.5, FLOOR_Y + 0.6, 0.8]} />
      </Suspense>
    </Canvas>
  )
}
