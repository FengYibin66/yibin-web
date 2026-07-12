import { Text, useTexture } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import {
  createPublicationCardBackViewModel,
  openPublicationPaper,
} from './publicationCardViewModel'
import type { PublicationCardFaceProps } from './publicationTypes'

const FONT_BOLD = '/fonts/CabinSketch-Bold.ttf'
const FONT_REGULAR = '/fonts/CabinSketch-Regular.ttf'
const BUTTON_TEXTURE_PATH = '/textures/gallery/przyciskdotylukartki.webp'
const BUTTON_WIDTH = 1
const BUTTON_ASPECT_RATIO = 3.613
const BUTTON_HEIGHT = BUTTON_WIDTH / BUTTON_ASPECT_RATIO
const disableRaycast: Mesh['raycast'] = () => undefined

export interface PublicationCardBackProps extends PublicationCardFaceProps {
  isOpen: boolean
}

export function PublicationCardBack({
  publication,
  opacity,
  isOpen,
}: PublicationCardBackProps) {
  const buttonTexture = useTexture(BUTTON_TEXTURE_PATH)
  const viewModel = createPublicationCardBackViewModel(publication)
  const paperAction = viewModel.paperAction

  const handlePaperClick = paperAction && isOpen
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        openPublicationPaper(paperAction.href)
      }
    : undefined

  return (
    <group rotation={[Math.PI, 0, 0]}>
      {paperAction && (
        <group position={[0, 0.6, 0]}>
          <mesh raycast={disableRaycast}>
            <planeGeometry args={[BUTTON_WIDTH, BUTTON_HEIGHT]} />
            <meshBasicMaterial
              color="#ffffff"
              map={buttonTexture}
              transparent
              opacity={opacity}
              alphaTest={0.05}
            />
          </mesh>
          <Text
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
            position={[0, 0, 0.02]}
            raycast={isOpen ? undefined : disableRaycast}
            onClick={handlePaperClick}
          >
            <planeGeometry args={[BUTTON_WIDTH, BUTTON_HEIGHT]} />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      <group position={[0, -0.3, 0]}>
        <Text
          position={[0, 0.15, 0.01]}
          fontSize={0.07}
          color="#1c1c1c"
          fillOpacity={opacity}
          font={FONT_BOLD}
          anchorX="center"
          anchorY="middle"
        >
          {viewModel.abstractHeading}
        </Text>
        <Text
          position={[0, -0.05, 0.01]}
          fontSize={0.06}
          color="#333333"
          fillOpacity={opacity}
          font={FONT_REGULAR}
          anchorX="center"
          anchorY="top"
          maxWidth={1.3}
          lineHeight={1.4}
        >
          {viewModel.abstract}
        </Text>
        <Text
          position={[0, -0.58, 0.01]}
          fontSize={0.05}
          color="#6a5a40"
          fillOpacity={opacity}
          font={FONT_REGULAR}
          anchorX="center"
          anchorY="top"
          maxWidth={1.3}
          lineHeight={1.3}
        >
          {viewModel.keywords}
        </Text>
      </group>
    </group>
  )
}
