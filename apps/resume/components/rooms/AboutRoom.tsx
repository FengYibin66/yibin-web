'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { Text, PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useScene } from '@/context/SceneContext'
import { useAchievements } from '@/context/AchievementsContext'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import { PaperAirplane } from './about/PaperAirplane'
import SkyChunk, { CHUNK_LENGTH, CORRIDOR_CLIP_Z, ROOM_Z } from './about/SkyChunk'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORY_CYCLE_LENGTH = 160
const AVATAR_LEGACY_ASPECT = 2816 / 1536
const AVATAR_WIDTH = 5
const AVATAR_HEIGHT = AVATAR_WIDTH / AVATAR_LEGACY_ASPECT

// ─── Props ────────────────────────────────────────────────────────────────────

interface AboutRoomProps {
  showRoom: boolean
  isExiting: boolean
}

// ─── Milestone components ─────────────────────────────────────────────────────

interface MilestoneProps {
  z: number
  scrollProgressRef: React.MutableRefObject<number>
}

function IntroMilestone({ z, scrollProgressRef }: MilestoneProps) {
  const avatarTexture = useLoader(THREE.TextureLoader, '/textures/about/awatarnachmurce.webp')
  const groupRef  = useRef<THREE.Group>(null)
  const titleRef  = useRef<{ position: THREE.Vector3 }>(null)
  const brandRef  = useRef<{ position: THREE.Vector3 }>(null)
  const avatarRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    avatarTexture.colorSpace = THREE.SRGBColorSpace
  }, [avatarTexture])

  useFrame((state) => {
    if (!groupRef.current) return
    const scrollProgress = scrollProgressRef.current
    const worldZ = ROOM_Z + scrollProgress + z
    groupRef.current.visible = worldZ < CORRIDOR_CLIP_Z
    if (!groupRef.current.visible) return

    const time = state.clock.elapsedTime
    const distanceZ = z + scrollProgress - 55
    const spreadStart = -70; const spreadEnd = -50
    let spreadFactor = 0
    if (distanceZ > spreadStart && distanceZ < spreadEnd) {
      const t = (distanceZ - spreadStart) / (spreadEnd - spreadStart)
      spreadFactor = Math.min(1, Math.max(0, t)) ** 2
    } else if (distanceZ >= spreadEnd) {
      spreadFactor = 1
    }

    if (titleRef.current)  titleRef.current.position.x = -spreadFactor * 15 * 0.8
    if (brandRef.current)  brandRef.current.position.x = spreadFactor * 15 * 0.6
    if (avatarRef.current) {
      avatarRef.current.position.y = 2 + Math.sin(time * 0.8) * 0.15 + spreadFactor * 3
      avatarRef.current.position.x = -spreadFactor * 15 * 0.3
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, z]}>
      <Text ref={titleRef as never} position={[0, 5, 0.1]} fontSize={0.8}
        color="#1a1a1a" anchorX="center" anchorY="middle"
        font="/fonts/RubikScribble-Regular.ttf">
        YIBIN FENG
      </Text>
      <Text ref={brandRef as never} position={[0, 4.3, 0.1]} fontSize={0.45}
        color="#4a4a4a" anchorX="center" anchorY="middle"
        font="/fonts/CabinSketch-Regular.ttf">
        AI Engineer · Builder
      </Text>
      <mesh ref={avatarRef} position={[0, 2, 0]}>
        <planeGeometry args={[AVATAR_WIDTH, AVATAR_HEIGHT]} />
        <meshBasicMaterial color="#e0e0e0" map={avatarTexture} transparent
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Text position={[0, 0, 0.1]} fontSize={0.3} color="#555555"
        anchorX="center" anchorY="middle" font="/fonts/CabinSketch-Regular.ttf">
        Building intelligent systems that shape human behavior
      </Text>
    </group>
  )
}

function JourneyMilestone({ z, scrollProgressRef }: MilestoneProps) {
  const uoTexture  = useLoader(THREE.TextureLoader, '/textures/about/uowyspa.webp')
  const frTexture  = useLoader(THREE.TextureLoader, '/textures/about/freelancewyspa.webp')
  const groupRef   = useRef<THREE.Group>(null)
  const uoRef      = useRef<THREE.Group>(null)
  const frRef      = useRef<THREE.Group>(null)
  const ISLAND_ASPECT = 2816 / 1536
  const ISLAND_HEIGHT = 4.5

  useEffect(() => {
    uoTexture.colorSpace = THREE.SRGBColorSpace
    frTexture.colorSpace = THREE.SRGBColorSpace
  }, [uoTexture, frTexture])

  useFrame((state) => {
    if (!groupRef.current) return
    const scrollProgress = scrollProgressRef.current
    const worldZ = ROOM_Z + scrollProgress + z
    groupRef.current.visible = worldZ < CORRIDOR_CLIP_Z
    if (!groupRef.current.visible) return

    const time = state.clock.elapsedTime
    const distanceZ = z + scrollProgress - 55
    const revealStart = -100; const revealEnd = -20
    let revealFactor = 0
    if (distanceZ > revealStart && distanceZ < revealEnd) {
      const t = (distanceZ - revealStart) / (revealEnd - revealStart)
      revealFactor = 1 - (1 - Math.min(1, Math.max(0, t))) ** 2
    } else if (distanceZ >= revealEnd) { revealFactor = 1 }

    if (uoRef.current) {
      uoRef.current.position.y = -2 + revealFactor * 3.5 + Math.sin(time * 0.5) * 0.2
      uoRef.current.rotation.z = Math.sin(time * 0.3) * 0.05
    }
    if (frRef.current) {
      frRef.current.position.y = -1 + revealFactor * 3.5 + Math.sin(time * 0.4 + 2) * 0.25
      frRef.current.rotation.z = Math.sin(time * 0.2 + 1) * -0.05
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, z]}>
      <Text position={[0, 5, 0.3]} fontSize={1.2} color="#1a1a1a"
        anchorX="center" anchorY="middle" font="/fonts/RubikScribble-Regular.ttf">
        JOURNEY
      </Text>
      <Text position={[0, 4.2, 0.3]} fontSize={0.35} color="#555555"
        anchorX="center" anchorY="middle" font="/fonts/CabinSketch-Regular.ttf">
        Education & Experience
      </Text>
      {/* NUS island (left) */}
      <group ref={uoRef} position={[-3.5, -2, 0]}>
        <mesh>
          <planeGeometry args={[ISLAND_HEIGHT * ISLAND_ASPECT, ISLAND_HEIGHT]} />
          <meshBasicMaterial color="#e0e0e0" map={uoTexture} transparent side={THREE.DoubleSide} />
        </mesh>
        <Text position={[0, -0.85, 0.1]} fontSize={0.4} color="#1a1a1a"
          anchorX="center" anchorY="middle" font="/fonts/CabinSketch-Bold.ttf">
          NUS 2023-2025
        </Text>
      </group>
      {/* TAL island (right) */}
      <group ref={frRef} position={[3.5, -1, 0.5]}>
        <mesh>
          <planeGeometry args={[ISLAND_HEIGHT * ISLAND_ASPECT, ISLAND_HEIGHT]} />
          <meshBasicMaterial color="#e0e0e0" map={frTexture} transparent side={THREE.DoubleSide} />
        </mesh>
        <Text position={[0, -0.65, 0.1]} fontSize={0.4} color="#1a1a1a"
          anchorX="center" anchorY="middle" font="/fonts/CabinSketch-Bold.ttf">
          TAL 2025-NOW
        </Text>
      </group>
    </group>
  )
}

// Simplified skills milestone — Text only (gas balloons are a separate complex subsystem)
function SkillsMilestone({ z, scrollProgressRef }: MilestoneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const SKILLS = ['React', 'Three.js', 'GSAP', 'Next.js', 'Go', 'Python', 'Docker', 'FastAPI']

  useFrame(() => {
    if (!groupRef.current) return
    const worldZ = ROOM_Z + scrollProgressRef.current + z
    groupRef.current.visible = worldZ < CORRIDOR_CLIP_Z
  })

  return (
    <group ref={groupRef} position={[0, 0, z]}>
      <Text position={[0, 6, 0.5]} fontSize={1.2} color="#1a1a1a"
        anchorX="center" anchorY="middle" font="/fonts/RubikScribble-Regular.ttf">
        SKILLS
      </Text>
      {SKILLS.map((skill, i) => {
        const col = i % 4
        const row = Math.floor(i / 4)
        return (
          <Text key={skill}
            position={[(col - 1.5) * 2.5, 4.5 - row * 1.2, 0.3]}
            fontSize={0.4} color="#2a1f0e"
            anchorX="center" anchorY="middle"
            font="/fonts/CabinSketch-Bold.ttf">
            {skill}
          </Text>
        )
      })}
    </group>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AboutRoom({ showRoom, isExiting }: AboutRoomProps) {
  const { camera }              = useThree()
  const { isTeleporting, roomLoadState } = useScene()
  const { unlockAchievement, showTutorial }   = useAchievements()
  const router = useWheelRouter()

  const scrollPos       = useRef(0)
  const scrollVelocity  = useRef(0)
  const currentBank     = useRef(0)
  const currentPitch    = useRef(0)
  const isFlightActive  = useRef(false)

  // showRoom ref for event handler guards
  const showRoomRef = useRef(showRoom)
  useEffect(() => { showRoomRef.current = showRoom }, [showRoom])

  // Reset on teleport
  useEffect(() => {
    if (isTeleporting) {
      currentBank.current      = 0
      currentPitch.current     = 0
      isFlightActive.current   = false
      scrollPos.current        = 0
      scrollVelocity.current   = 0
    }
  }, [isTeleporting])

  useEffect(() => {
    if (roomLoadState.phase !== 'entered') return
    const tutorialTimer = window.setTimeout(() => showTutorial('about_scroll'), 2000)
    return () => window.clearTimeout(tutorialTimer)
  }, [roomLoadState.phase, showTutorial])

  // For InfiniteSkyChunks: world group moves with scrollPos
  const [activeChunks, setActiveChunks] = useState<number[]>([-1, 0, 1, 2])
  const [activeStoryCycles, setActiveStoryCycles] = useState<number[]>([-1, 0, 1])
  const worldRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (isExiting || isTeleporting) return

    // Momentum scroll
    scrollPos.current      += scrollVelocity.current * delta * 60
    scrollVelocity.current *= 0.95
    if (Math.abs(scrollVelocity.current) < 0.001) scrollVelocity.current = 0

    if (scrollPos.current > 15) unlockAchievement('about_scroll')

    // Move world group with scroll
    if (worldRef.current) {
      worldRef.current.position.z = scrollPos.current

      // Update active chunks
      const currentChunk   = Math.floor(scrollPos.current / 40)
      const newChunks      = [currentChunk - 1, currentChunk, currentChunk + 1, currentChunk + 2]
      const chunksChanged  = newChunks.some(c => !activeChunks.includes(c)) || activeChunks.some(c => !newChunks.includes(c))
      if (chunksChanged) setActiveChunks(newChunks)

      const currentCycle   = Math.floor(scrollPos.current / STORY_CYCLE_LENGTH)
      const newCycles      = [currentCycle - 1, currentCycle, currentCycle + 1]
      const cyclesChanged  = newCycles.some(c => !activeStoryCycles.includes(c)) || activeStoryCycles.some(c => !newCycles.includes(c))
      if (cyclesChanged) setActiveStoryCycles(newCycles)
    }

    // Flight effect (bank/pitch)
    if (!isFlightActive.current && scrollPos.current > 0.5) isFlightActive.current = true
    if (isFlightActive.current) {
      const chunkProgress  = (scrollPos.current % 40) / 40
      const flightProgress = Math.min(1, (scrollPos.current - 0.5) / 5.0)
      const bankAngle      = Math.sin(chunkProgress * Math.PI * 2) * 0.12 * flightProgress
      const pitchAngle     = Math.sin(chunkProgress * Math.PI * 4) * 0.05 * flightProgress
      const lerpSpeed      = 1 - Math.pow(0.02, delta)
      currentBank.current  = THREE.MathUtils.lerp(currentBank.current,  bankAngle,  lerpSpeed)
      currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, pitchAngle, lerpSpeed)
      camera.rotation.x = currentPitch.current
      camera.rotation.z = currentBank.current
    }
  })

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!showRoomRef.current || isExiting) return
    scrollVelocity.current += e.deltaY * 0.002
  }, [isExiting])

  const lastTouchY = useRef(0)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    lastTouchY.current = e.touches[0].clientY
  }, [])
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!showRoomRef.current || isExiting) return
    const delta = lastTouchY.current - e.touches[0].clientY
    lastTouchY.current = e.touches[0].clientY
    scrollVelocity.current += delta * 0.005
  }, [isExiting])

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove',  handleTouchMove,  { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove',  handleTouchMove)
    }
  }, [handleTouchStart, handleTouchMove])

  useEffect(() => {
    const unsub = router.subscribe('room:about', handleWheel)
    return () => { unsub(); router.deactivate('room:about') }
  }, [router, handleWheel])

  useEffect(() => {
    if (showRoom && !isExiting) {
      router.activate('room:about')
    } else {
      router.deactivate('room:about')
    }
  }, [showRoom, isExiting, router])

  if (!showRoom) return null

  return (
    <group position={[0, 0, -25]}>
      {/* Ambient wind sound */}
      <PositionalAudio
        url="/sounds/szumwiatru.mp3"
        distanceModel="exponential"
        refDistance={2}
        rolloffFactor={0.8}
        loop
        autoplay
        volume={2.5}
      />

      {/* Sky backdrop */}
      <mesh position={[0, 0, -200]}>
        <planeGeometry args={[400, 200]} />
        <meshBasicMaterial color="#d4e8f5" side={THREE.DoubleSide} />
      </mesh>

      {/* Paper airplane (bank/pitch from flight effect applied via camera, airplane mirrors it) */}
      <group position={[0, -0.3, 1]}
        rotation={[currentPitch.current * 3 + 0.1, 0, -currentBank.current * 2]}>
        <PaperAirplane scale={0.8} color="#faf8f5" />
      </group>

      {/* Infinite sky + story content (moves with scrollPos) */}
      <group ref={worldRef}>
        {activeChunks.map(chunkIndex => (
          <SkyChunk key={`chunk-${chunkIndex}`} chunkIndex={chunkIndex} seed={42}
            scrollProgressRef={scrollPos} />
        ))}

        {activeStoryCycles.map(cycleIndex => (
          <group key={`story-${cycleIndex}`}>
            <IntroMilestone
              z={-(cycleIndex * STORY_CYCLE_LENGTH + 15)}
              scrollProgressRef={scrollPos} />
            <JourneyMilestone
              z={-(cycleIndex * STORY_CYCLE_LENGTH + 95)}
              scrollProgressRef={scrollPos} />
            <SkillsMilestone
              z={-(cycleIndex * STORY_CYCLE_LENGTH + 135)}
              scrollProgressRef={scrollPos} />
          </group>
        ))}
      </group>
    </group>
  )
}
