'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import type * as THREE from 'three'
import gsap from 'gsap'

export function CorridorWindow() {
  const avatarRef = useRef<THREE.Mesh>(null)
  const windowTex = useTexture('/textures/corridor/window_sketch.webp')
  const avatarTex = useTexture('/textures/corridor/avatar_window.webp')

  const handlePointerEnter = () => {
    if (!avatarRef.current) return
    // After rotation=[0,-π/2,0], local +Z points into the corridor; avatar slides in along Z
    gsap.to(avatarRef.current.position, { z: 0.1, duration: 0.5, ease: 'back.out(1.7)', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0.1, duration: 0.5, ease: 'power2.out', overwrite: true })
  }

  const handlePointerLeave = () => {
    if (!avatarRef.current) return
    gsap.to(avatarRef.current.position, { z: 2.0, duration: 0.4, ease: 'power2.in', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0, duration: 0.4, ease: 'power2.in', overwrite: true })
  }

  return (
    // position.x = 3.49 (flush with right wall), rotation.y = -π/2 so face points inward (-X)
    <group position={[3.49, 0.3, -30]} rotation={[0, -Math.PI / 2, 0]}>
      {/* 窗外背景 — behind window frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[1.3, 1.1]} />
        <meshBasicMaterial color="#d6e4f0" />
      </mesh>

      {/* Avatar — starts fully outside wall (local z=2.0), slides in to z=0.1 on hover */}
      <mesh ref={avatarRef} position={[0, 0, 2.0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={avatarTex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>

      {/* Window frame — hover trigger, sits on wall face (z=0) */}
      <mesh onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={windowTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}
