'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

const RUBIK_SCRIBBLE_URL = '/fonts/RubikScribble-Regular.ttf'
const CABIN_SKETCH_URL   = '/fonts/CabinSketch-Regular.ttf'

const easeOutQuad = (t: number) => t * (2 - t)

function SmallStar({ position, scale = 0.1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]}>
          <planeGeometry args={[1, 0.12]} />
          <meshBasicMaterial color="#555" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

interface HeroTextProps {
  visible?: boolean
  position?: [number, number, number]
}

export function HeroText({ visible = true, position = [0, 0.3, -2] }: HeroTextProps) {
  const groupRef    = useRef<THREE.Group>(null)
  const letterRefs  = useRef<(THREE.Object3D | null)[]>([])
  const taglineRefs = useRef<(THREE.Object3D | null)[]>([])
  const { camera }  = useThree()

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const t = Math.max(0, Math.min(1, (Math.max(320, Math.min(1200, w)) - 320) / 880))
      setScale(0.65 + t * 0.35)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const splitAmount  = useRef(0)
  const targetSplit  = useRef(0)
  const worldPos     = useRef(new THREE.Vector3())

  // "YIBIN" — five letters spread symmetrically
  const letters = useMemo(() => [
    { char: 'Y', baseX: -1.05, splitDir: -2.0 },
    { char: 'I', baseX: -0.52, splitDir: -0.8 },
    { char: 'B', baseX:  0.0,  splitDir:  0.0 },
    { char: 'I', baseX:  0.52, splitDir:  0.8 },
    { char: 'N', baseX:  1.05, splitDir:  2.0 },
  ], [])

  const taglineWords = useMemo(() => [
    { text: '<',           baseX: -0.85, splitDir: -1.5 },
    { text: 'AI Engineer', baseX: -0.22, splitDir: -0.7 },
    { text: '/>',          baseX:  0.62, splitDir:  1.5 },
  ], [])

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime

    // Split based on camera proximity
    groupRef.current.getWorldPosition(worldPos.current)
    const dist = camera.position.z - worldPos.current.z

    const SPLIT_START = 3, SPLIT_PEAK = 0, SPLIT_END = -2, SPLIT_MAX = 0.9
    if (dist > SPLIT_PEAK && dist < SPLIT_START) {
      targetSplit.current = SPLIT_MAX * easeOutQuad((SPLIT_START - dist) / (SPLIT_START - SPLIT_PEAK))
    } else if (dist <= SPLIT_PEAK && dist > SPLIT_END) {
      targetSplit.current = SPLIT_MAX * easeOutQuad((dist - SPLIT_END) / (SPLIT_PEAK - SPLIT_END))
    } else {
      targetSplit.current = 0
    }
    splitAmount.current = THREE.MathUtils.lerp(splitAmount.current, targetSplit.current, 0.08)

    letterRefs.current.forEach((ref, i) => {
      if (!ref) return
      const l = letters[i]
      ref.position.x = l.baseX + l.splitDir * splitAmount.current
      ref.position.y = 0.2 + Math.sin(time * 0.7 + i * 0.5) * 0.015
      ref.rotation.z = Math.sin(time * 0.5 + i) * 0.02 * (1 + splitAmount.current)
    })

    taglineRefs.current.forEach((ref, i) => {
      if (!ref) return
      const w = taglineWords[i]
      ref.position.x = w.baseX + w.splitDir * splitAmount.current * 0.6
      ref.position.y = -0.45 + Math.sin(time * 0.6 + i * 0.3) * 0.008
    })

    // Subtle float
    groupRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.02
    groupRef.current.visible = visible
  })

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, 1]}>
      {letters.map((l, i) => (
        <Text
          key={`${l.char}-${i}`}
          ref={(el: THREE.Object3D | null) => { letterRefs.current[i] = el }}
          position={[l.baseX, 0.2, 0]}
          fontSize={0.9}
          font={RUBIK_SCRIBBLE_URL}
          color="#2a1f0e"
          outlineWidth={0.01}
          outlineColor="#1a1208"
          anchorX="center"
          anchorY="middle"
        >
          {l.char}
        </Text>
      ))}

      {taglineWords.map((w, i) => (
        <Text
          key={w.text}
          ref={(el: THREE.Object3D | null) => { taglineRefs.current[i] = el }}
          position={[w.baseX, -0.55, 0.3]}
          fontSize={0.14}
          font={CABIN_SKETCH_URL}
          color="#6b5744"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
        >
          {w.text}
        </Text>
      ))}

      <SmallStar position={[-1.3, 0.6, 0]} scale={0.06} />
      <SmallStar position={[ 1.3, 0.5, 0]} scale={0.05} />
      <SmallStar position={[-1.1, -0.6, 0]} scale={0.04} />
      <SmallStar position={[ 1.1, -0.55, 0]} scale={0.035} />
    </group>
  )
}
