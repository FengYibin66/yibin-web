import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const CORRIDOR_HEIGHT = 3.5
const CORRIDOR_WIDTH = 7
const CORRIDOR_LENGTH = 220   // Covers two door loops (original + repeat at -100)
const ALCOVE_DEPTH = 1.8      // How far each alcove side wall extends inward
const FLOOR_Y = -CORRIDOR_HEIGHT / 2
const CEILING_Y = CORRIDOR_HEIGHT / 2

// Point lights every 15 units for even warm coverage across full corridor length
const LIGHT_Z_POSITIONS = Array.from({ length: 13 }, (_, i) => 5 - i * 15)

export function CorridorGeometry() {
  const wallTex = useTexture('/textures/corridor/wall_texture.webp')
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(CORRIDOR_LENGTH / 4, CORRIDOR_HEIGHT / 2)

  const floorTex = useTexture('/textures/corridor/floor_wood.webp')
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(CORRIDOR_WIDTH / 3, CORRIDOR_LENGTH / 3)

  const ceilingTex = useTexture('/textures/corridor/ceiling_texture.webp')
  ceilingTex.wrapS = ceilingTex.wrapT = THREE.RepeatWrapping
  ceilingTex.repeat.set(CORRIDOR_WIDTH / 2, CORRIDOR_LENGTH / 4)

  const baseboardTex = useTexture('/textures/corridor/texturadoprogow.webp')
  baseboardTex.wrapS = baseboardTex.wrapT = THREE.RepeatWrapping
  baseboardTex.repeat.set(CORRIDOR_LENGTH / 2, 1)

  // Corridor Z center: camera goes to z=-190, center is z=-90
  const centerZ = -90

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, centerZ]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH]} />
        <meshBasicMaterial map={floorTex} color="#d0c8b8" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_Y, centerZ]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH]} />
        <meshBasicMaterial map={ceilingTex} color="#e8e4dc" />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wallTex} color="#e0ddd4" />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wallTex} color="#e0ddd4" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 0, -190]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial color="#c8c4bc" />
      </mesh>

      {/* Baseboards — floor/wall junction on both sides */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2 + 0.02, FLOOR_Y + 0.06, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, 0.12]} />
        <meshBasicMaterial map={baseboardTex} color="#c8c4b0" />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2 - 0.02, FLOOR_Y + 0.06, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, 0.12]} />
        <meshBasicMaterial map={baseboardTex} color="#c8c4b0" />
      </mesh>

      {/* Slightly dimmer ambient for more depth contrast */}
      <ambientLight intensity={0.9} color="#f0ebe0" />

      {/* Dense point lights every 15 units — consistent warm pools along full length */}
      {LIGHT_Z_POSITIONS.map((z) => (
        <pointLight
          key={z}
          position={[0, 1.5, z]}
          intensity={1.2}
          color="#fff3dc"
          distance={25}
          decay={2}
        />
      ))}
    </group>
  )
}

// ─── Alcove side walls ────────────────────────────────────────────────────────
// Each door sits in a shallow alcove: two short planes perpendicular to the
// corridor axis give the side walls visual depth (replaces flat continuous wall).
interface AlcoveProps {
  doorPositions: Array<{ z: number; side: 'left' | 'right' }>
}

export function CorridorAlcoves({ doorPositions }: AlcoveProps) {
  const wallTex = useTexture('/textures/corridor/wall_texture.webp')
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(0.45, CORRIDOR_HEIGHT / 2)

  return (
    <group>
      {doorPositions.map(({ z, side }) => {
        const wallX  = side === 'left' ? -CORRIDOR_WIDTH / 2 : CORRIDOR_WIDTH / 2
        // Face the plane toward the corridor centre
        const rotY   = side === 'left' ? 0 : Math.PI
        return (
          <group key={`alcove-${side}-${z}`}>
            {/* Front return wall */}
            <mesh position={[wallX, 0, z + ALCOVE_DEPTH]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[ALCOVE_DEPTH, CORRIDOR_HEIGHT]} />
              <meshBasicMaterial map={wallTex} color="#d4d0c8" />
            </mesh>
            {/* Back return wall */}
            <mesh position={[wallX, 0, z - ALCOVE_DEPTH]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[ALCOVE_DEPTH, CORRIDOR_HEIGHT]} />
              <meshBasicMaterial map={wallTex} color="#d4d0c8" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
