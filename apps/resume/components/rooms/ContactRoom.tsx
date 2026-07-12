'use client'

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { SocialBarrel } from './contact/SocialBarrel'
import { MessagePaper } from './contact/MessagePaper'

interface ContactRoomProps {
  showRoom: boolean
  onReady: () => void
  isExiting: boolean
}

const WAVE_LAYERS = 4

const LATARNIA_SETTINGS = {
  position: [-10, 5, -20] as [number, number, number],
  rotation: [0, 0.1, 0] as [number, number, number],
  scale: [4.49, 5] as [number, number],
}
const STATEK_SETTINGS = {
  position: [0, 1.6, -15] as [number, number, number],
  rotation: [0, -0.2, 0] as [number, number, number],
  scale: [3.35, 1.3] as [number, number],
}

export function ContactRoom({ showRoom, onReady, isExiting }: ContactRoomProps) {
  const { isTeleporting } = useScene()
  const { unlockAchievement, showTutorial } = useAchievements()

  const hasSignaled  = useRef(false)
  const frameCount   = useRef(0)
  const waveRefs     = useRef<(THREE.Mesh | null)[]>([])
  const statekRef    = useRef<THREE.Mesh>(null)
  const audioRef     = useRef<{ setVolume: (v: number) => void } | null>(null)

  const seaTexture      = useTexture('/textures/contact/faletopdown.webp')
  const moloTexture     = useTexture('/textures/contact/molo.webp')
  const latarniaTexture = useTexture('/textures/contact/latarnia.webp')
  const statekTexture   = useTexture('/textures/contact/statek.webp')

  useEffect(() => {
    if (seaTexture) {
      seaTexture.wrapS = seaTexture.wrapT = THREE.MirroredRepeatWrapping
      seaTexture.repeat.set(6, 4)
      seaTexture.needsUpdate = true
    }
    if (moloTexture) {
      moloTexture.wrapS = moloTexture.wrapT = THREE.RepeatWrapping
      moloTexture.center.set(0.5, 0.5)
      moloTexture.rotation = Math.PI / 2
      moloTexture.repeat.set(1, 1)
      moloTexture.needsUpdate = true
    }
  }, [seaTexture, moloTexture])

  // Reset hasSignaled on teleport so onReady fires again on re-entry
  useEffect(() => {
    if (isTeleporting) {
      hasSignaled.current = false
      frameCount.current = 0
    }
  }, [isTeleporting])

  useFrame((state, delta) => {
    if (!hasSignaled.current) {
      frameCount.current++
      if (frameCount.current >= 10) {
        hasSignaled.current = true
        onReady()
        setTimeout(() => showTutorial('contact_found'), 2000)
      }
    }
    if (isExiting) return

    const t = state.clock.getElapsedTime()

    // Wave animation
    waveRefs.current.forEach((ref, i) => {
      if (ref) {
        const speed = 0.8 + i * 0.15
        const amplitude = 0.15 - i * 0.02
        const offset = i * 0.5
        ref.position.y = Math.sin(t * speed + offset) * amplitude
      }
    })

    // Ship bobbing + sailing
    if (statekRef.current) {
      statekRef.current.position.y = STATEK_SETTINGS.position[1] + Math.sin(t * 0.8) * 0.3
      statekRef.current.position.x = STATEK_SETTINGS.position[0] + Math.sin(t * 0.04) * 12
      statekRef.current.rotation.z = Math.sin(t * 0.96) * 0.05
    }
  })

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1000)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!showRoom) return null

  return (
    <group position={[0, -0.7, -5]}>
      <PositionalAudio ref={audioRef as never} url="/sounds/szummorza.mp3" distanceModel="exponential" refDistance={2} rolloffFactor={1.2} loop autoplay volume={2} />

      {/* Simple clouds */}
      {[[-8, 4, -8], [6, 5, -10], [-4, 6, -14], [10, 4, -12]].map(([cx, cy, cz], i) => (
        <mesh key={i} position={[cx as number, cy as number, cz as number]}>
          <planeGeometry args={[3 + i * 0.5, 1 + i * 0.2]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Ocean waves */}
      <group position={[0, -1, -8]}>
        {Array.from({ length: WAVE_LAYERS }).map((_, i) => (
          <mesh
            key={i}
            ref={el => { waveRefs.current[i] = el }}
            position={[0, -i * 0.1, -i * 8]}
            rotation={[-Math.PI / 2.5, 0, 0]}
          >
            <planeGeometry args={[80, 30]} />
            <meshBasicMaterial
              map={seaTexture}
              color="#ffffff"
              transparent
              opacity={1 - i * 0.1}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Social barrels */}
      <SocialBarrel
        position={isMobile ? [-1.2, 0.5, -10] : [-3, 0.5, -10]}
        rotation={[0, 0.2, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="LINKEDIN"
        onClick={() => { window.open('https://linkedin.com/in/yibinfeng-imperial', '_blank'); unlockAchievement('contact_found') }}
      />
      <SocialBarrel
        position={isMobile ? [-1.5, -0.3, -7] : [-5, -0.3, -8]}
        rotation={[0, 0.3, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="GITHUB"
        onClick={() => { window.open('https://github.com/FengYibin66', '_blank'); unlockAchievement('contact_found') }}
      />
      <SocialBarrel
        position={isMobile ? [1.2, 0.5, -10] : [3, 0.5, -10]}
        rotation={[0, -0.2, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="EMAIL"
        onClick={() => { window.open('mailto:fengyibinapply@163.com', '_blank'); unlockAchievement('contact_found') }}
      />
      <SocialBarrel
        position={isMobile ? [1.5, -0.3, -7] : [5, -0.3, -8]}
        rotation={[0, -0.3, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="MESSAGE"
        onClick={() => {}}
      />

      {/* Dock / Molo */}
      <mesh position={[0, 0.05, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 7]} />
        <meshBasicMaterial map={moloTexture} color="#e0e0e0" side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Lighthouse */}
      <mesh position={LATARNIA_SETTINGS.position} rotation={LATARNIA_SETTINGS.rotation}>
        <planeGeometry args={LATARNIA_SETTINGS.scale} />
        <meshBasicMaterial color="#e0e0e0" map={latarniaTexture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Ship */}
      <mesh ref={statekRef} position={STATEK_SETTINGS.position} rotation={STATEK_SETTINGS.rotation}>
        <planeGeometry args={STATEK_SETTINGS.scale} />
        <meshBasicMaterial color="#e0e0e0" map={statekTexture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Message paper on dock */}
      <MessagePaper position={[0, 0.07, 2]} onSend={() => unlockAchievement('contact_found')} />
    </group>
  )
}
