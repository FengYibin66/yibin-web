'use client'

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { LAB_FONT_LATIN_REGULAR, fontForText } from '@/lib/lab/domain/labFonts'
import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import type { TallySpec } from '@/lib/lab/domain/sketch/types'
import { sketchTexture } from '@/lib/lab/infra/sketch/textureCache'
import { useAudio } from '@/context/AudioContext'

const DOOR_HEIGHT     = 2.4
const DOOR_WIDTH      = DOOR_HEIGHT * 0.391
const FLOOR_Y         = -1.75
const DOOR_CENTER_Y   = FLOOR_Y + DOOR_HEIGHT / 2  // -0.55
const CORRIDOR_HEIGHT = 3.5
const CORRIDOR_WIDTH  = 7

const OPEN_DIST  = 12
const CLOSE_DIST = 18

interface SegmentDoorProps {
  position: [number, number, number]
  label?: string
}

export function SegmentDoor({ position, label = 'while(true) { explore(); }' }: SegmentDoorProps) {
  const { play } = useAudio()

  const leftTex   = useTexture('/textures/corridor/doors/doorrleft.webp')
  const rightTex  = useTexture('/textures/corridor/doors/dorright.webp')
  const frameTex  = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const handleTex = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')

  // Wall decoration textures
  const ideaTex      = useTexture('/textures/corridor/decorations/idea_process.webp')
  const coffeeTex    = useTexture('/textures/corridor/decorations/coffee_debug.webp')
  const whileTrueTex = useTexture('/textures/corridor/decorations/while_true_loop.webp')

  const leftRef      = useRef<THREE.Group>(null)
  const rightRef     = useRef<THREE.Group>(null)
  const isOpenRef    = useRef(false)
  const isClosingRef = useRef(false)

  const { camera } = useThree()

  useFrame(() => {
    const distZ = Math.abs(camera.position.z - position[2])
    const distX = Math.abs(camera.position.x - position[0])
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    if (distZ < OPEN_DIST && distX < 1.5 && !isOpenRef.current) {
      isOpenRef.current    = true
      isClosingRef.current = false
      play('door_open')
      gsap.to(left.rotation,  { y: -Math.PI * 0.55, duration: 0.9, ease: 'power2.out', delay: 0.1 })
      gsap.to(right.rotation, { y:  Math.PI * 0.55, duration: 0.9, ease: 'power2.out', delay: 0.1 })
    }

    if ((distZ > CLOSE_DIST || distX > 2.5) && isOpenRef.current && !isClosingRef.current) {
      isClosingRef.current = true
      isOpenRef.current    = false
      gsap.to(left.rotation,  { y: 0, duration: 0.7, ease: 'power2.in' })
      gsap.to(right.rotation, { y: 0, duration: 0.7, ease: 'power2.in',
        onComplete: () => { isClosingRef.current = false },
      })
    }
  })

  const frameW          = DOOR_WIDTH * 2 + 0.2
  const doorOpeningW    = DOOR_WIDTH * 2
  const sideWallW       = (CORRIDOR_WIDTH - doorOpeningW) / 2
  const wallCenterY     = FLOOR_Y + CORRIDOR_HEIGHT / 2        // 0
  const topWallHeight   = CORRIDOR_HEIGHT - DOOR_HEIGHT        // 1.1
  const topWallCenterY  = FLOOR_Y + DOOR_HEIGHT + topWallHeight / 2  // 1.2
  const leftWallCenterX = -(doorOpeningW / 2 + sideWallW / 2)
  const rightWallCenterX = doorOpeningW / 2 + sideWallW / 2

  return (
    <group position={position}>
      {/* === Solid walls (box geometry) — block view when door is closed === */}
      <mesh position={[leftWallCenterX, wallCenterY, 0]}>
        <boxGeometry args={[sideWallW, CORRIDOR_HEIGHT, 0.12]} />
        <meshBasicMaterial color="#e0ddd4" />
      </mesh>
      <mesh position={[rightWallCenterX, wallCenterY, 0]}>
        <boxGeometry args={[sideWallW, CORRIDOR_HEIGHT, 0.12]} />
        <meshBasicMaterial color="#e0ddd4" />
      </mesh>
      <mesh position={[0, topWallCenterY, 0]}>
        <boxGeometry args={[doorOpeningW, topWallHeight, 0.12]} />
        <meshBasicMaterial color="#e0ddd4" />
      </mesh>

      {/* === Left wall decoration: Idea Process === */}
      <mesh
        position={[leftWallCenterX, wallCenterY, 0.07]}
        rotation={[0, 0, 0.05]}
      >
        <planeGeometry args={[1.2, 1.2 / 0.402]} />
        <meshBasicMaterial map={ideaTex} transparent alphaTest={0.1} />
      </mesh>

      {/* === Right wall decoration: Coffee Debug === */}
      <mesh
        position={[rightWallCenterX, wallCenterY, 0.08]}
        rotation={[0, 0, -0.05]}
      >
        <planeGeometry args={[2.2, 2.2 / 1.833]} />
        <meshBasicMaterial map={coffeeTex} transparent alphaTest={0.1} />
      </mesh>

      {/* 走了几圈：门框上方一枚正字计数（规格 lab-corridor-story.md §4） */}
      <LapTally y={topWallCenterY} />

      {/* === Top wall decoration: While True Loop === */}
      <mesh position={[0, topWallCenterY, 0.07]}>
        <planeGeometry args={[1.4, 1.4 / 1.833]} />
        <meshBasicMaterial map={whileTrueTex} transparent alphaTest={0.1} />
      </mesh>

      <mesh position={[0, DOOR_CENTER_Y, 0]}>
        <planeGeometry args={[frameW, DOOR_HEIGHT + 0.2]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      <group ref={leftRef} position={[-DOOR_WIDTH, DOOR_CENTER_Y, 0.02]}>
        <mesh position={[DOOR_WIDTH / 2, 0, 0]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={leftTex} />
        </mesh>
      </group>

      <group ref={rightRef} position={[DOOR_WIDTH, DOOR_CENTER_Y, 0.02]}>
        <mesh position={[-DOOR_WIDTH / 2, 0, 0]}>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshBasicMaterial map={rightTex} />
        </mesh>
      </group>

      <mesh position={[DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.06]}>
        <planeGeometry args={[0.08, 0.22]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>

      <Text
        position={[0, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.35, 0.05]}
        fontSize={0.13}
        color="#8b7355"
        font={fontForText(label, LAB_FONT_LATIN_REGULAR)}
        anchorX="center"
        anchorY="middle"
        maxWidth={2.5}
      >
        {label}
      </Text>
    </group>
  )
}

/**
 * 段末门上的正字计数。第 0 圈什么都没有；之后每圈一画，满五画成一个"正"。
 * 读的是世界状态里的圈数（ADR 20260908172231），不是相机位置。
 */
function LapTally({ y }: { y: number }) {
  const lap = useCorridorStore(s => s.lap)
  // 第 0 圈什么都不画，也不栅格化（早退在 hooks 之前：整个子组件不渲染）
  if (lap <= 0) return null
  return <LapTallyMark y={y} lap={lap} />
}

function LapTallyMark({ y, lap }: { y: number; lap: number }) {
  const spec = useMemo<TallySpec>(
    () => ({ kind: 'tally', id: `lap-${lap}`, size: { width: 160, height: 64 }, count: lap }),
    [lap],
  )
  const texture = useMemo(() => sketchTexture(spec), [spec])
  return (
    <mesh position={[1.35, y + 0.55, 0.09]} rotation={[0, 0, -0.04]}>
      <planeGeometry args={[0.6, 0.24]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} depthWrite={false} />
    </mesh>
  )
}
