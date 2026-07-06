import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const CORRIDOR_HEIGHT = 3.5
const CORRIDOR_WIDTH = 7
const CORRIDOR_LENGTH = 220   // Covers two door loops (original + repeat at -100)
const FLOOR_Y = -CORRIDOR_HEIGHT / 2
const CEILING_Y = CORRIDOR_HEIGHT / 2

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

  // Corridor Z center: camera now goes to z=-190, so center is z=-90
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

      {/* Back wall (end of extended corridor) */}
      <mesh position={[0, 0, -190]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial color="#c8c4bc" />
      </mesh>

      {/* Ambient light for warm corridor feel */}
      <ambientLight intensity={1.2} color="#f5f0e8" />
      <pointLight position={[0, 1.5,   5]} intensity={0.8} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5,  -20]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5,  -45]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5,  -70]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5,  -95]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -120]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -145]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -170]} intensity={0.6} color="#fff8e8" distance={30} />
    </group>
  )
}
