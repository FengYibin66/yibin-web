import { Text } from '@react-three/drei'
import { createPublicationCardFrontViewModel } from './publicationCardViewModel'
import type { PublicationCardFaceProps } from './publicationTypes'

const FONT_BOLD = '/fonts/CabinSketch-Bold.ttf'
const FONT_REGULAR = '/fonts/CabinSketch-Regular.ttf'
const FEATURED_COLOR = '#c4804a'
const VENUE_COLOR = '#888888'

export function PublicationCardFront({
  publication,
  opacity,
}: PublicationCardFaceProps) {
  const viewModel = createPublicationCardFrontViewModel(publication)
  const venueColor = viewModel.isFeatured ? FEATURED_COLOR : VENUE_COLOR

  return (
    <group>
      <Text
        position={[0, 0.6, 0.01]}
        fontSize={0.1}
        color={venueColor}
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="middle"
      >
        {viewModel.venueAndYear}
      </Text>
      {viewModel.isFeatured && (
        <Text
          position={[0.45, 0.85, 0.01]}
          fontSize={0.07}
          color={FEATURED_COLOR}
          fillOpacity={opacity}
          font={FONT_BOLD}
        >
          ★
        </Text>
      )}
      <Text
        position={[0, 0.3, 0.01]}
        fontSize={0.09}
        color="#2a1f0e"
        fillOpacity={opacity}
        font={FONT_BOLD}
        anchorX="center"
        anchorY="top"
        maxWidth={1.3}
        lineHeight={1.3}
      >
        {viewModel.title}
      </Text>
      <Text
        position={[0, -0.65, 0.01]}
        fontSize={0.065}
        color="#6a5a40"
        fillOpacity={opacity}
        font={FONT_REGULAR}
        anchorX="center"
        anchorY="top"
        maxWidth={1.3}
        lineHeight={1.3}
      >
        {viewModel.authors}
      </Text>
    </group>
  )
}
