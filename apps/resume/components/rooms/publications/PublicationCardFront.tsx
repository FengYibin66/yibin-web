'use client'

import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Mesh } from 'three'
import { useLocale } from '@/hooks/useLocale'
import { createPublicationCardFrontViewModel } from './publicationCardViewModel'
import { getPublicationFonts } from './publicationFonts'
import {
  PUBLICATION_BODY_MAX_WIDTH,
  PUBLICATION_TEXT_OVERFLOW_WRAP,
  PUBLICATION_TITLE_MAX_WIDTH,
} from './publicationTextLayout'
import type { PublicationCardFaceProps } from './publicationTypes'

const disableRaycast: Mesh['raycast'] = () => undefined
const IMAGE_WIDTH = 1.25
const IMAGE_HEIGHT = 0.78

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
  const { locale } = useLocale()
  const fonts = getPublicationFonts(locale)
  const viewModel = createPublicationCardFrontViewModel(publication)
  const cover = useTexture(publication.image ?? '/publications-cscw-cover.png')
  cover.colorSpace = THREE.SRGBColorSpace
  const isZh = locale === 'zh'

  return (
    <group>
      <Text
        depthTest={depthTest}
        renderOrder={renderOrder + 1}
        position={[0, 0.82, 0.03]}
        fontSize={isZh ? 0.068 : 0.08}
        color="#1c1c1c"
        fillOpacity={opacity}
        font={fonts.bold}
        anchorX="center"
        anchorY="top"
        maxWidth={PUBLICATION_TITLE_MAX_WIDTH}
        overflowWrap={PUBLICATION_TEXT_OVERFLOW_WRAP}
        whiteSpace="normal"
        lineHeight={1.2}
        raycast={disableRaycast}
      >
        {viewModel.title}
      </Text>

      <mesh
        position={[0, -0.02, 0.025]}
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
        font={fonts.latinBold}
        anchorX="center"
        anchorY="middle"
        maxWidth={PUBLICATION_BODY_MAX_WIDTH}
        overflowWrap={PUBLICATION_TEXT_OVERFLOW_WRAP}
        whiteSpace="normal"
        raycast={disableRaycast}
      >
        {viewModel.venueAndYear}
      </Text>
    </group>
  )
}
