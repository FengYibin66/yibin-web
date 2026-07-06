'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

const CEILING_Y = 1.75  // CORRIDOR_HEIGHT(3.5) / 2

export function BugEaster() {
  const bugRef = useRef<THREE.Mesh>(null)
  const inkRef = useRef<THREE.Mesh>(null)
  const [clicked, setClicked] = useState(false)
  const [clipProg, setClipProg] = useState(0)

  const bugTex = useTexture('/textures/corridor/bug_sketch.webp')
  const inkTex = useTexture('/textures/corridor/ink_splash.webp')

  useFrame((state) => {
    if (clicked || !bugRef.current) return
    const t = state.clock.elapsedTime
    bugRef.current.position.x = 2 + Math.sin(t * 0.8) * 0.3 + Math.sin(t * 1.5) * 0.1
    bugRef.current.position.y = (CEILING_Y - 0.5) + Math.cos(t * 0.6) * 0.2 + Math.cos(t * 1.1) * 0.1
    bugRef.current.rotation.z = Math.sin(t * 5) * 0.1
  })

  const handleBugClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (clicked) return
    setClicked(true)

    if (inkRef.current) {
      inkRef.current.visible = true
      gsap.fromTo(
        inkRef.current.scale,
        { x: 0, y: 0, z: 1 },
        { x: 0.8, y: 0.8, z: 1, duration: 0.4, ease: 'back.out(1.7)' }
      )
    }

    // Reveal text via clipRect progress 0→1
    const proxy = { progress: 0 }
    gsap.to(proxy, {
      progress: 1,
      duration: 0.8,
      ease: 'power1.inOut',
      onUpdate() { setClipProg(proxy.progress) },
    })
  }

  return (
    <group position={[0, 0, -70]}>
      {!clicked && (
        <mesh ref={bugRef} position={[2, CEILING_Y - 0.5, 0.2]} onClick={handleBugClick}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial map={bugTex} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      )}

      {/* Ink splash appears on click */}
      <mesh ref={inkRef} position={[2, CEILING_Y - 0.5, 0.3]} visible={false}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial map={inkTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>

      {/* "BUG FIXED!" revealed left-to-right via clipRect */}
      {clicked && (
        <Text
          position={[2, CEILING_Y - 0.5, 0.4]}
          fontSize={0.2}
          color="#f5e6a3"
          font="/fonts/CabinSketch-Bold.ttf"
          anchorX="center"
          anchorY="middle"
          clipRect={[-1, -0.3, -1 + clipProg * 2.5, 0.3]}
        >
          BUG FIXED!
        </Text>
      )}
    </group>
  )
}
