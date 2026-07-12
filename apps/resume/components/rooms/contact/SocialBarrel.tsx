'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import '@/components/lab/shaders/RevealMaterial'

const _tempScale = new THREE.Vector3()

interface SocialBarrelProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  texturePath: string
  label: string
  onClick?: () => void
  scale?: [number, number]
}

export function SocialBarrel({
  position,
  rotation = [0, 0, 0],
  texturePath,
  label,
  onClick,
  scale = [2.12, 2.3],
}: SocialBarrelProps) {
  const meshRef    = useRef<THREE.Group>(null)
  const materialRef  = useRef<{ uProgress: number } | null>(null)
  const paintedRef   = useRef<THREE.Mesh>(null)
  const hideDelayRef = useRef<gsap.core.Tween | null>(null)

  const texture        = useTexture(texturePath)
  const paintedPath    = texturePath.replace('.webp', '_painted.webp').replace('.png', '_painted.png')
  const texturePainted = useTexture(paintedPath)

  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.getElapsedTime()
    const phaseOffset = position[0] * 0.5
    meshRef.current.position.y = position[1] + Math.sin(time * 0.8 + phaseOffset) * 0.15
    meshRef.current.position.x = position[0] + Math.sin(time * 0.4 + phaseOffset) * 0.2
    meshRef.current.rotation.z = rotation[2] + Math.sin(time * 0.6 + phaseOffset) * 0.05

    const targetScale = hovered ? 1.1 : 1
    meshRef.current.scale.lerp(_tempScale.set(targetScale, targetScale, 1), 0.1)
  })

  const handlePointerOver = () => {
    document.body.style.cursor = 'pointer'
    setHovered(true)
    if (materialRef.current) {
      gsap.to(materialRef.current, { uProgress: 1.0, duration: 0.8, ease: 'power2.out', overwrite: true })
    }
    if (hideDelayRef.current) hideDelayRef.current.kill()
    if (paintedRef.current) paintedRef.current.visible = true
  }

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto'
    setHovered(false)
    if (materialRef.current) {
      gsap.to(materialRef.current, { uProgress: 0.0, duration: 0.5, ease: 'power2.out', overwrite: true })
    }
    hideDelayRef.current = gsap.delayedCall(0.55, () => {
      if (paintedRef.current) paintedRef.current.visible = false
    })
  }

  return (
    <group
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Painted layer (behind) */}
      <mesh ref={paintedRef} position={[0, 0, -0.001]} visible={false}>
        <planeGeometry args={scale} />
        <meshBasicMaterial color="#e0e0e0" map={texturePainted} transparent alphaTest={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Sketch layer (front) with reveal */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={scale} />
        {/* @ts-expect-error revealMaterial registered via extend() */}
        <revealMaterial
          ref={materialRef}
          color="#e0e0e0"
          map={texture}
          transparent
          alphaTest={0.1}
          uProgress={0.0}
        />
      </mesh>

      {label && (
        <Text
          position={[0, scale[1] * 0.26, 0.05]}
          rotation={[0, 0, 0.03]}
          fontSize={scale[0] * 0.14}
          font="/fonts/CabinSketch-Bold.ttf"
          color="#111111"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  )
}
