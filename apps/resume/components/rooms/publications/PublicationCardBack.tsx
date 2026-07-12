'use client'

import { Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import {
  createPublicationCardBackViewModel,
  createPublicationCardFrontViewModel,
  openPublicationPaper,
} from './publicationCardViewModel'
import type { PublicationCardFaceProps } from './publicationTypes'

const FONT_BOLD = '/fonts/CabinSketch-Bold.ttf'
const FONT_REGULAR = '/fonts/CabinSketch-Regular.ttf'
const CTA_WIDTH = 1.05
const CTA_HEIGHT = 0.28
const disableRaycast: Mesh['raycast'] = () => undefined

export interface PublicationCardBackProps extends PublicationCardFaceProps {
  isOpen: boolean
}

/**
 * Detail / reading face — content-first, no borrowed empty frames:
 * Title → Venue · Year → Abstract → Keywords → solid VIEW PAPER CTA.
 */
export function PublicationCardBack({
  publication,
  opacity,
  isOpen,
  depthTest = true,
  renderOrder = 0,
}: PublicationCardBackProps) {
  const viewModel = createPublicationCardBackViewModel(publication)
  const front = createPublicationCardFrontViewModel(publication)
  const paperAction = viewModel.paperAction

  const handlePaperClick = (event: ThreeEvent<MouseEvent>): void => {
    if (!paperAction || !isOpen) return
    event.stopPropagation()
    console.log('[pub-debug] VIEW PAPER click', paperAction.href)
    openPublicationPaper(paperAction.href)
  }

  return (
    <group rotation={[Math.PI, 0, 0]}>
      <Text
        depthTest={depthTest}
        renderOrder={renderOrder}
        position={[0, 0.82, 0.02]}
        fontSize={0.075}
        color="#1c1c1c"
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="top"
        maxWidth={1.28}
        lineHeight={1.18}
        raycast={disableRaycast}
      >
        {front.title}
      </Text>

      <Text
        depthTest={depthTest}
        renderOrder={renderOrder}
        position={[0, 0.42, 0.02]}
        fontSize={0.058}
        color="#6a5a40"
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.28}
        raycast={disableRaycast}
      >
        {front.venueAndYear}
      </Text>

      <mesh
        position={[0, 0.3, 0.015]}
        renderOrder={renderOrder}
        raycast={disableRaycast}
      >
        <planeGeometry args={[0.9, 0.01]} />
        <meshBasicMaterial
          color="#b5a078"
          transparent
          opacity={0.55 * opacity}
          depthTest={depthTest}
          depthWrite={false}
        />
      </mesh>

      <Text
        depthTest={depthTest}
        renderOrder={renderOrder}
        position={[0, 0.2, 0.02]}
        fontSize={0.052}
        color="#333333"
        fillOpacity={opacity}
        font={FONT_REGULAR}
        anchorX="center"
        anchorY="top"
        maxWidth={1.28}
        lineHeight={1.35}
        raycast={disableRaycast}
      >
        {viewModel.abstract}
      </Text>

      <Text
        depthTest={depthTest}
        renderOrder={renderOrder}
        position={[0, -0.55, 0.02]}
        fontSize={0.042}
        color="#8a7355"
        fillOpacity={opacity}
        font={FONT_REGULAR}
        anchorX="center"
        anchorY="top"
        maxWidth={1.28}
        lineHeight={1.25}
        raycast={disableRaycast}
      >
        {viewModel.keywords}
      </Text>

      {paperAction && (
        <group position={[0, -0.85, 0.02]}>
          <mesh raycast={disableRaycast} renderOrder={renderOrder}>
            <planeGeometry args={[CTA_WIDTH, CTA_HEIGHT]} />
            <meshBasicMaterial
              color="#f7f2e8"
              transparent
              opacity={opacity}
              depthTest={depthTest}
              depthWrite={false}
            />
          </mesh>
          {/* simple border */}
          <mesh
            position={[0, 0, -0.001]}
            raycast={disableRaycast}
            renderOrder={renderOrder}
          >
            <planeGeometry args={[CTA_WIDTH + 0.04, CTA_HEIGHT + 0.04]} />
            <meshBasicMaterial
              color="#2a1f0e"
              transparent
              opacity={0.35 * opacity}
              depthTest={depthTest}
              depthWrite={false}
            />
          </mesh>
          <Text
            depthTest={depthTest}
            renderOrder={renderOrder + 1}
            position={[0, 0, 0.01]}
            fontSize={0.09}
            color="#1c1c1c"
            fillOpacity={opacity}
            font={FONT_BOLD}
            anchorX="center"
            anchorY="middle"
            raycast={disableRaycast}
          >
            {paperAction.label}
          </Text>
          <mesh
            name="publication-paper-hit-area"
            position={[0, 0, 0.02]}
            renderOrder={renderOrder + 2}
            onClick={handlePaperClick}
            onPointerOver={(event) => {
              if (!isOpen) return
              event.stopPropagation()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[CTA_WIDTH + 0.04, CTA_HEIGHT + 0.04]} />
            <meshBasicMaterial
              color="#e0e0e0"
              transparent
              opacity={0}
              depthWrite={false}
              depthTest={depthTest}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
