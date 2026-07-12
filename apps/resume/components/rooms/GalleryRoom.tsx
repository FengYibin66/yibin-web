'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'

interface GalleryRoomProps {
  showRoom: boolean
  onReady: () => void
  isExiting: boolean
}

const GALLERY_ITEMS = [
  { id: 'resume',  title: 'Resume Site',        tech: ['Three.js', 'Next.js', 'GSAP'],  url: 'https://resume.yibinfeng.com', color: '#4a8fa8' },
  { id: 'wechat',  title: 'WeChat AI Platform',  tech: ['Go', 'Vue 3', 'Python'],        url: 'https://mpauto.yibinfeng.com',  color: '#7ab87a' },
  { id: 'video',   title: 'AI Video Generator',  tech: ['React', 'LLM', 'FastAPI'],      url: undefined,                       color: '#c4804a' },
  { id: 'cli',     title: 'One-CLI',             tech: ['Go', 'Docker', 'React'],        url: undefined,                       color: '#9a72c0' },
]

const GAP = 2.6
const CARD_W = 1.8
const CARD_H = 2.2

export function GalleryRoom({ showRoom, onReady, isExiting }: GalleryRoomProps) {
  const { isTeleporting } = useScene()
  const { unlockAchievement } = useAchievements()

  const hasSignaled   = useRef(false)
  const frameCount    = useRef(0)
  const targetScroll  = useRef(0)
  const currentScroll = useRef(0)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  useEffect(() => {
    if (isTeleporting) {
      targetScroll.current = 0
      currentScroll.current = 0
      setSelectedCard(null)
    }
  }, [isTeleporting])

  useFrame((_, delta) => {
    if (!hasSignaled.current) {
      frameCount.current++
      if (frameCount.current >= 10) {
        hasSignaled.current = true
        onReady()
      }
    }
    currentScroll.current = THREE.MathUtils.lerp(currentScroll.current, targetScroll.current, delta * 5)
  })

  const handleWheel = useCallback((e: WheelEvent) => {
    if (selectedCard) return
    targetScroll.current += e.deltaY * 0.005
    unlockAchievement('gallery_inspect')
  }, [selectedCard, unlockAchievement])

  const lastTouchX = useRef(0)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    lastTouchX.current = e.touches[0].clientX
  }, [])
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (selectedCard) return
    const dx = lastTouchX.current - e.touches[0].clientX
    lastTouchX.current = e.touches[0].clientX
    targetScroll.current += dx * 0.008
    unlockAchievement('gallery_inspect')
  }, [selectedCard, unlockAchievement])

  useEffect(() => {
    window.addEventListener('wheel', handleWheel)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove])

  if (!showRoom) return null

  const TOTAL = GALLERY_ITEMS.length * GAP

  return (
    <group position={[0, -0.7, -2]}>
      {/* Sky */}
      <mesh position={[0, 3, -20]}>
        <sphereGeometry args={[35, 24, 24]} />
        <meshBasicMaterial color="#e8f4fc" side={THREE.BackSide} />
      </mesh>

      {/* City backdrop */}
      <mesh position={[0, 1, -18]}>
        <planeGeometry args={[40, 10]} />
        <meshBasicMaterial color="#d0d8e4" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor/balcony */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]}>
        <planeGeometry args={[10, 6]} />
        <meshBasicMaterial color="#e0d8c8" />
      </mesh>

      {/* Railing */}
      <mesh position={[0, 0.6, -4]}>
        <planeGeometry args={[12, 1.2]} />
        <meshBasicMaterial color="#c8c0b0" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Clothesline rope */}
      <mesh position={[0, 1.6, -4]}>
        <cylinderGeometry args={[0.012, 0.012, 18, 6]} />
        <meshBasicMaterial color="#666" />
      </mesh>

      {/* Project cards */}
      <group position={[0, 1.6, -4]}>
        {GALLERY_ITEMS.map((item, i) => {
          const rawX   = i * GAP - currentScroll.current
          const half   = TOTAL / 2
          const dispX  = ((rawX + half) % TOTAL + TOTAL) % TOTAL - half
          const isSelected = selectedCard === item.id

          return (
            <GalleryCard
              key={item.id}
              item={item}
              x={dispX}
              isSelected={isSelected}
              onSelect={() => {
                setSelectedCard(selectedCard === item.id ? null : item.id)
                unlockAchievement('gallery_inspect')
              }}
            />
          )
        })}
      </group>

      {/* Clouds */}
      {[[-8, 4, -10], [6, 5, -12], [-4, 6, -16], [10, 4, -14]].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <planeGeometry args={[3 + i * 0.5, 1 + i * 0.2]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

interface GalleryCardProps {
  item: typeof GALLERY_ITEMS[0]
  x: number
  isSelected: boolean
  onSelect: () => void
}

function GalleryCard({ item, x, isSelected, onSelect }: GalleryCardProps) {
  const [hovered, setHovered] = useState(false)
  const targetY = isSelected ? 0.5 : 0
  const targetZ = isSelected ? 1.2 : 0

  return (
    <group
      position={[x, targetY, targetZ]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Clothespin */}
      <mesh position={[0, -0.05, 0.1]} rotation={[0, 0, Math.PI]}>
        <boxGeometry args={[0.2, 0.25, 0.1]} />
        <meshBasicMaterial color="#c4a882" />
      </mesh>

      {/* Card */}
      <group position={[0, -1.2, 0]}>
        <mesh>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshBasicMaterial
            color={hovered || isSelected ? '#ffffff' : '#f5f0e8'}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Color accent bar */}
        <mesh position={[0, CARD_H / 2 - 0.15, 0.01]}>
          <planeGeometry args={[CARD_W, 0.3]} />
          <meshBasicMaterial color={item.color} />
        </mesh>

        {/* Title */}
        <Text
          position={[0, 0.5, 0.02]}
          fontSize={0.18}
          color="#2a1f0e"
          font="/fonts/CabinSketch-Bold.ttf"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.6}
        >
          {item.title}
        </Text>

        {/* Tech stack */}
        {item.tech.map((t, ti) => (
          <Text
            key={ti}
            position={[0, 0.2 - ti * 0.18, 0.02]}
            fontSize={0.1}
            color="#6a5a40"
            font="/fonts/CabinSketch-Regular.ttf"
            anchorX="center"
          >
            {t}
          </Text>
        ))}

        {/* URL hint */}
        {isSelected && item.url && (
          <Text
            position={[0, -0.7, 0.02]}
            fontSize={0.1}
            color="#5577bb"
            font="/fonts/CabinSketch-Bold.ttf"
            anchorX="center"
            onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); window.open(item.url!, '_blank') }}
          >
            ↗ Open Project
          </Text>
        )}
      </group>
    </group>
  )
}
