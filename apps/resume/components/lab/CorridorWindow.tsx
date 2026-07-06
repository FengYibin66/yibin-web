'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

export function CorridorWindow() {
  const avatarRef = useRef<THREE.Mesh>(null)
  const windowTex = useTexture('/textures/corridor/window_sketch.webp')
  const avatarTex = useTexture('/textures/corridor/avatar_window.webp')

  const handlePointerEnter = () => {
    if (!avatarRef.current) return
    gsap.to(avatarRef.current.position, { x: 3.0, duration: 0.5, ease: 'back.out(1.7)', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0.1, duration: 0.5, ease: 'power2.out', overwrite: true })
  }

  const handlePointerLeave = () => {
    if (!avatarRef.current) return
    gsap.to(avatarRef.current.position, { x: 4.5, duration: 0.4, ease: 'power2.in', overwrite: true })
    gsap.to(avatarRef.current.rotation, { z: 0, duration: 0.4, ease: 'power2.in', overwrite: true })
  }

  return (
    <group position={[3.2, 0.3, -30]}>
      {/* Avatar — starts hidden beyond the right wall */}
      <mesh ref={avatarRef} position={[4.5, 0, 0.04]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={avatarTex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>

      {/* Window frame — hover trigger */}
      <mesh onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={windowTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}
