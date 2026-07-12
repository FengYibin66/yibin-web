'use client'

import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Text, useTexture, PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import PaperMaterial, { type PaperMaterialHandle } from './gallery/PaperMaterial'
import { GalleryClouds } from './gallery/GalleryClouds'

const PUBS = [
  {
    id: 'cscw25',
    title: 'Multi-Agent Systems Shape Social Norms for Prosocial Behavior Change',
    venue: "CSCW '25",
    year: 2025,
    authors: 'Yibin Feng, Tianqi Song, Yugin Tan, Zicheng Zhu, Yi-Chieh Lee',
    doi: 'https://doi.org/10.1145/3715070.3749246',
    abstract: 'In-group agents led to 62% donation increase vs 25% for out-group, showing AI groups influence behavior through social identity dynamics.',
    featured: true,
  },
  {
    id: 'acm23',
    title: 'Multi-Agents as Social Groups: Investigating Social Influence of Multiple Agents',
    venue: 'ACM CSCW',
    year: 2023,
    authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
    doi: 'https://dl.acm.org/doi/abs/10.1145/3757633',
    abstract: 'Explores how multi-agent systems exercise social influence in human-agent interactions.',
    featured: false,
  },
  {
    id: 'chi25',
    title: 'Greater than the Sum of its Parts: Exploring Social Influence of Multi-Agents',
    venue: 'CHI EA 2025',
    year: 2025,
    authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
    doi: 'https://dl.acm.org/doi/full/10.1145/3706599.3719973',
    abstract: 'Examines emergent social influence properties of multi-agent systems beyond individual capabilities.',
    featured: false,
  },
]

const PUB_COUNT = PUBS.length
const GAP      = 2.6
const CARD_W   = 1.5
const CARD_H   = 2.0
const RAILING_H = 1.25
const BIRD_W = 0.49, BIRD_H = 0.35

const ROPE_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-10, 3.5, -6),
  new THREE.Vector3(-5,  2.5, -4.5),
  new THREE.Vector3(0,   1.8, -3),
  new THREE.Vector3(5,   2.5, -4.5),
  new THREE.Vector3(10,  3.5, -6),
])

interface PublicationsRoomProps {
  showRoom: boolean
  isExiting: boolean
}

export function PublicationsRoom({ showRoom, isExiting }: PublicationsRoomProps) {
  const { isTeleporting } = useScene()
  const { unlockAchievement, showTutorial } = useAchievements()
  const router = useWheelRouter()

  const hasSignaled    = useRef(false)
  const frameCount     = useRef(0)
  const targetScroll   = useRef(0)
  const currentScroll  = useRef(0)
  const showRoomRef    = useRef(showRoom)
  const [selectedCard, setSelectedCard]         = useState<number | null>(null)
  const [globalAnimating, setGlobalAnimating]   = useState(false)
  const cardRefs = useRef<({ open: () => Promise<void>; close: () => Promise<void> } | null)[]>([])

  useEffect(() => { showRoomRef.current = showRoom }, [showRoom])

  useEffect(() => {
    if (isTeleporting) {
      hasSignaled.current   = false
      frameCount.current    = 0
      targetScroll.current  = 0
      currentScroll.current = 0
      setSelectedCard(null)
      setGlobalAnimating(false)
    }
  }, [isTeleporting])

  useFrame((_, delta) => {
    if (!hasSignaled.current) {
      frameCount.current++
      if (frameCount.current >= 10) { hasSignaled.current = true; setTimeout(() => showTutorial('publications_read'), 2000) }
    }
    if (isExiting) return
    currentScroll.current = THREE.MathUtils.lerp(currentScroll.current, targetScroll.current, delta * 5)
  })

  const scrollToIndex = useCallback((index: number) => {
    const total = PUB_COUNT * GAP
    const target = index * GAP
    let diff = target - currentScroll.current
    const half = total / 2
    while (diff > half)  diff -= total
    while (diff < -half) diff += total
    gsap.to(targetScroll,  { current: currentScroll.current + diff, duration: 0.5, ease: 'power2.inOut' })
    gsap.to(currentScroll, { current: currentScroll.current + diff, duration: 0.5, ease: 'power2.inOut' })
  }, [])

  const handleCardClick = useCallback(async (clickedIdx: number) => {
    if (globalAnimating) return
    unlockAchievement('publications_read')
    if (selectedCard === clickedIdx) {
      setGlobalAnimating(true)
      await cardRefs.current[clickedIdx]?.close()
      setSelectedCard(null)
      setGlobalAnimating(false)
    } else if (selectedCard !== null) {
      setGlobalAnimating(true)
      await cardRefs.current[selectedCard]?.close()
      setSelectedCard(null)
      await cardRefs.current[clickedIdx]?.open()
      setSelectedCard(clickedIdx)
      setGlobalAnimating(false)
    } else {
      setGlobalAnimating(true)
      await cardRefs.current[clickedIdx]?.open()
      setSelectedCard(clickedIdx)
      setGlobalAnimating(false)
    }
  }, [globalAnimating, selectedCard, unlockAchievement])

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!showRoomRef.current || isExiting || selectedCard !== null) return
    targetScroll.current += e.deltaY * 0.005
    unlockAchievement('publications_read')
  }, [isExiting, selectedCard, unlockAchievement])

  useEffect(() => {
    const unsub = router.subscribe('room:publications', handleWheel)
    return () => { unsub(); router.deactivate('room:publications') }
  }, [router, handleWheel])

  useEffect(() => {
    if (showRoom && !isExiting && selectedCard === null) {
      router.activate('room:publications')
    } else {
      router.deactivate('room:publications')
    }
  }, [showRoom, isExiting, selectedCard, router])

  const floorTex   = useTexture('/textures/gallery/floor.webp')
  const railingTex = useTexture('/textures/gallery/railing.webp')
  const housesTex  = useTexture('/textures/gallery/domki.webp')
  const cityTex    = useTexture('/textures/gallery/miastotlo.webp')
  const birdTex    = useTexture('/textures/gallery/bird_gray.webp')
  const claspTex   = useTexture('/textures/gallery/klamerka.webp')
  const backTex    = useTexture('/textures/gallery/tylkartki.webp')
  const btnTex     = useTexture('/textures/gallery/przyciskdotylukartki.webp')

  useEffect(() => {
    if (floorTex) {
      floorTex.wrapS = THREE.MirroredRepeatWrapping
      floorTex.wrapT = THREE.MirroredRepeatWrapping
      floorTex.repeat.set(0.5, 0.5 * 1.835)
      floorTex.needsUpdate = true
    }
    if (railingTex) {
      railingTex.wrapS = railingTex.wrapT = THREE.RepeatWrapping
      railingTex.repeat.set(7, 1)
      railingTex.needsUpdate = true
    }
  }, [floorTex, railingTex])

  const ropeGeo    = useMemo(() => new THREE.TubeGeometry(ROPE_CURVE, 64, 0.015, 8, false), [])
  const floorShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-1.1, -2.0); s.lineTo(1.1, -2.0)
    s.lineTo(7.5, 4); s.lineTo(-7.5, 4); s.lineTo(-1.1, -2.0)
    return s
  }, [])

  if (!showRoom) return null

  const TOTAL = PUB_COUNT * GAP

  return (
    <group>
      <PositionalAudio ref={null} url="/sounds/szummiasta.mp3" distanceModel="exponential" refDistance={2} rolloffFactor={1.5} loop autoplay volume={0.6} />

      <group position={[0, -0.7, -2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <shapeGeometry args={[floorShape]} />
          <meshBasicMaterial map={floorTex} color="#e0e0e0" side={THREE.DoubleSide} />
        </mesh>

        <mesh position={[0, RAILING_H / 2, -3.9]}>
          <planeGeometry args={[20, RAILING_H]} />
          <meshBasicMaterial color="#e0e0e0" map={railingTex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
        </mesh>

        <group position={[0, 1.6, -4]}>
          <mesh geometry={ropeGeo}>
            <meshBasicMaterial color="#666666" />
          </mesh>

          {PUBS.map((pub, i) => {
            const rawX  = i * GAP - currentScroll.current
            const half  = TOTAL / 2
            const dispX = ((rawX + half) % TOTAL + TOTAL) % TOTAL - half
            return (
              <PubCard
                key={pub.id}
                index={i}
                ref={(el) => { cardRefs.current[i] = el }}
                pub={pub}
                currentScroll={currentScroll}
                total={TOTAL}
                isSelected={selectedCard === i}
                isAnimating={globalAnimating}
                scrollToIndex={scrollToIndex}
                onClick={handleCardClick}
                claspTex={claspTex}
                backTex={backTex}
                btnTex={btnTex}
                curve={ROPE_CURVE}
                initialDispX={dispX}
              />
            )
          })}
        </group>

        {[0, -15, 15].map((x, i) => (
          <mesh key={i} position={[x, -1, -9]} scale={i === 2 ? [-1, 1, 1] : [1, 1, 1]}>
            <planeGeometry args={[15, 15 / 2.357]} />
            <meshBasicMaterial color="#e0e0e0" map={housesTex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {[0, -30, 30].map((x, i) => (
          <mesh key={i} position={[x, 3.4, -17]} scale={i === 2 ? [-1, 1, 1] : [1, 1, 1]}>
            <planeGeometry args={[30, 30 / 2.357]} />
            <meshBasicMaterial color="#e0e0e0" map={cityTex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
          </mesh>
        ))}

        <FlyingBird texture={birdTex} />
        <GalleryClouds count={45} seed={99} />

        <mesh position={[0, 5, -20]}>
          <sphereGeometry args={[40, 32, 32]} />
          <meshBasicMaterial color="#f0f0f0" side={THREE.BackSide} transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  )
}

function FlyingBird({ texture }: { texture: THREE.Texture }) {
  const ref = useRef<THREE.Mesh>(null)
  const velY = useRef(0)
  const jumpTimer = useRef(0)
  useFrame((_, delta) => {
    if (!ref.current) return
    const safe = Math.min(delta, 0.05)
    ref.current.position.x += 2.5 * safe
    if (ref.current.position.x > 25) { ref.current.position.x = -25; ref.current.position.y = 4.5; velY.current = 0; jumpTimer.current = 0 }
    velY.current += -12 * safe
    ref.current.position.y += velY.current * safe
    jumpTimer.current -= safe
    if (jumpTimer.current <= 0 || ref.current.position.y < 3.2) { velY.current = 5.5; jumpTimer.current = 0.9 + Math.random() * 0.3 }
    ref.current.position.y = THREE.MathUtils.clamp(ref.current.position.y, 3.0, 6.5)
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, THREE.MathUtils.clamp(velY.current * 0.05, -Math.PI / 6, Math.PI / 8), safe * 8)
  })
  return (
    <mesh ref={ref} position={[-25, 4.5, -10]} scale={[BIRD_W, BIRD_H, 1]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial color="#e0e0e0" map={texture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

interface PubCardProps {
  index: number
  pub: typeof PUBS[0]
  currentScroll: React.MutableRefObject<number>
  total: number
  isSelected: boolean
  isAnimating: boolean
  scrollToIndex: (i: number) => void
  onClick: (i: number) => void
  claspTex: THREE.Texture
  backTex: THREE.Texture
  btnTex: THREE.Texture
  curve: THREE.CatmullRomCurve3
  initialDispX: number
}

interface PubCardHandle { open: () => Promise<void>; close: () => Promise<void> }

const PubCard = memo(forwardRef<PubCardHandle, PubCardProps>(function PubCard(
  { index, pub, currentScroll, total, isSelected, isAnimating, scrollToIndex, onClick, claspTex, backTex, btnTex, curve },
  ref
) {
  const cardRef  = useRef<THREE.Group>(null)
  const paperRef = useRef<THREE.Group>(null)
  const matRef   = useRef<PaperMaterialHandle>(null)
  const [hovered, setHovered] = useState(false)
  const swaySpeed  = useRef(0.3 + Math.random() * 0.2)
  const swayOffset = useRef(Math.random() * 100)

  useImperativeHandle(ref, () => ({
    open: () => new Promise<void>((resolve) => {
      scrollToIndex(index)
      setTimeout(() => {
        if (!paperRef.current) { resolve(); return }
        const tl = gsap.timeline({ onComplete: resolve })
        tl.to(paperRef.current.position, { y: -0.5, duration: 0.15, ease: 'power2.out' })
        tl.to(paperRef.current.position, { y: 0.4, x: 0, z: 1.5, duration: 0.5, ease: 'power3.out' })
        tl.to(paperRef.current.rotation, { x: Math.PI, y: 0, z: 0, duration: 0.5, ease: 'power3.out' }, '<')
        if (matRef.current) gsap.to(matRef.current, { uProgress: 1.0, duration: 0.5, ease: 'power2.out' })
      }, 500)
    }),
    close: () => new Promise<void>((resolve) => {
      if (!paperRef.current) { resolve(); return }
      const tl = gsap.timeline({ onComplete: resolve })
      tl.to(paperRef.current.position, { y: -1.1, x: 0, z: 0, duration: 0.4, ease: 'power2.inOut' })
      tl.to(paperRef.current.rotation, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'power2.inOut' }, '<')
      if (matRef.current) gsap.to(matRef.current, { uProgress: 0.0, duration: 0.4, ease: 'power2.out' })
    }),
  }))

  useFrame((state) => {
    if (!cardRef.current || isSelected) return
    const rawX  = index * GAP - currentScroll.current
    const half  = total / 2
    const dispX = ((rawX + half) % total + total) % total - half
    const u     = THREE.MathUtils.clamp((dispX + 10) / 20, 0, 1)
    const pt    = curve.getPointAt(u)
    cardRef.current.position.set(pt.x, pt.y, pt.z)
    const wind  = Math.sin(state.clock.elapsedTime * swaySpeed.current + swayOffset.current) * 0.05
    cardRef.current.rotation.z = wind
    cardRef.current.rotation.x = 0
    cardRef.current.scale.setScalar(THREE.MathUtils.clamp(1 - Math.abs(dispX) / 50, 0.7, 1))
  })

  const BTN_ASPECT = 3.613

  return (
    <group
      ref={cardRef}
      onClick={(e) => { e.stopPropagation(); if (!isAnimating) onClick(index) }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      <mesh position={[0, -0.08, 0.15]} rotation={[0, 0, Math.PI]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial color="#ffffff" map={claspTex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      <group ref={paperRef} position={[0, -1.1, 0]}>
        <mesh>
          <planeGeometry args={[CARD_W, CARD_H, 16, 16]} />
          <PaperMaterial ref={matRef} color={hovered ? '#fffde8' : '#ffffff'} mapBack={backTex} side={THREE.DoubleSide} />
        </mesh>

        {/* Back: button */}
        <group position={[0, 0.6, 0]} rotation={[Math.PI, 0, 0]}>
          <mesh><planeGeometry args={[1.0, 1.0 / BTN_ASPECT]} /><meshBasicMaterial color="#ffffff" map={btnTex} transparent alphaTest={0.05} /></mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.09} color="#1c1c1c" font="/fonts/CabinSketch-Bold.ttf" anchorX="center" anchorY="middle">VIEW PAPER</Text>
          <mesh position={[0, 0, 0.02]} onClick={(e: ThreeEvent<MouseEvent>) => { if (isSelected) { e.stopPropagation(); window.open(pub.doi, '_blank') } }}>
            <planeGeometry args={[1.0, 1.0 / BTN_ASPECT]} /><meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>

        {/* Back: abstract */}
        <group position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
          <Text position={[0, 0.15, 0.01]} fontSize={0.07} color="#1c1c1c" font="/fonts/CabinSketch-Bold.ttf" anchorX="center" anchorY="middle">ABSTRACT</Text>
          <Text position={[0, -0.05, 0.01]} fontSize={0.06} color="#333" font="/fonts/CabinSketch-Regular.ttf" anchorX="center" anchorY="top" maxWidth={1.3} lineHeight={1.4}>{pub.abstract}</Text>
        </group>

        {/* Front: content */}
        <Text position={[0, 0.6, 0.01]} fontSize={0.1} color={pub.featured ? '#c4804a' : '#888'} font="/fonts/CabinSketch-Bold.ttf" anchorX="center" anchorY="middle">{pub.venue} · {pub.year}</Text>
        {pub.featured && <Text position={[0.45, 0.85, 0.01]} fontSize={0.07} color="#c4804a" font="/fonts/CabinSketch-Bold.ttf">★</Text>}
        <Text position={[0, 0.3, 0.01]} fontSize={0.09} color="#2a1f0e" font="/fonts/CabinSketch-Bold.ttf" anchorX="center" anchorY="top" maxWidth={1.3} lineHeight={1.3}>{pub.title}</Text>
        <Text position={[0, -0.65, 0.01]} fontSize={0.065} color="#6a5a40" font="/fonts/CabinSketch-Regular.ttf" anchorX="center" anchorY="top" maxWidth={1.3} lineHeight={1.3}>{pub.authors}</Text>
      </group>
    </group>
  )
}))
