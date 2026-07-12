'use client'

import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Mesh } from 'three'
import { createPublicationCardFrontViewModel } from './publicationCardViewModel'
import type { PublicationCardFaceProps } from './publicationTypes'

const FONT_BOLD = '/fonts/CabinSketch-Bold.ttf'
const disableRaycast: Mesh['raycast'] = () => undefined
const IMAGE_WIDTH = 1.25
const IMAGE_HEIGHT = 0.85

/**
 * Hanging preview stack (top → bottom):
 * Title → cover image → Venue · Year
 */
export function PublicationCardFront({
  publication,
  opacity,
  depthTest = true,
  renderOrder = 0,
}: PublicationCardFaceProps) {
  const viewModel = createPublicationCardFrontViewModel(publication)
  const cover = useTexture(publication.image ?? '/publications-cscw-cover.png')
  cover.colorSpace = THREE.SRGBColorSpace

  return (
    <group>
      <Text
        depthTest={depthTest}
        renderOrder={renderOrder + 1}
        position={[0, 0.78, 0.03]}
        fontSize={0.08}
        color="#1c1c1c"
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="top"
        maxWidth={1.3}
        lineHeight={1.15}
        raycast={disableRaycast}
      >
        {viewModel.title}
      </Text>

      <mesh
        position={[0, 0.02, 0.025]}
        renderOrder={renderOrder}
        raycast={disableRaycast}
      >
        <planeGeometry args={[IMAGE_WIDTH, IMAGE_HEIGHT]} />
        <meshBasicMaterial
          map={cover}
          color="#ffffff"
          transparent
          opacity={opacity}
          depthTest={depthTest}
          depthWrite
        />
      </mesh>

      <Text
        depthTest={depthTest}
        renderOrder={renderOrder + 1}
        position={[0, -0.72, 0.03]}
        fontSize={0.065}
        color="#6a5a40"
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.3}
        raycast={disableRaycast}
      >
        {viewModel.venueAndYear}
      </Text>
    </group>
  )
}
