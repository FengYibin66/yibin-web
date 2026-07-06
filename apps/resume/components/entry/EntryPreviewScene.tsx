'use client'

import { Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CorridorGeometry } from '@/components/lab/CorridorGeometry'
import { Cat } from '@/components/lab/Cat'
import { Doodles } from '@/components/lab/Doodles'
import * as THREE from 'three'

function EntryCamera() {
  const { camera } = useThree()

  useFrame((state) => {
    const px = state.pointer.x
    const py = state.pointer.y

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.3, 0.05)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.5 + py * 0.1, 0.05)
    camera.lookAt(px * 0.2, 0.2, -5)
  })
  return null
}

export function EntryPreviewScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 6], fov: 50, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <EntryCamera />
        <CorridorGeometry />
        <Cat position={[-1.2, -1.15, 2]} />
        <Doodles offsetZ={3} />
      </Suspense>
    </Canvas>
  )
}
