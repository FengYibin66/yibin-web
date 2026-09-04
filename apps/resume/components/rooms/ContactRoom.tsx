'use client'

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useRoomCamera } from '@/hooks/useRoomCamera'
import { useAchievementActions } from '@/context/AchievementsContext'
import { useLocale } from '@/hooks/useLocale'
import { getContactRoomLinks } from '@/lib/content/labAdapters'
import { SocialBarrel } from './contact/SocialBarrel'
import { MessagePaper, type MessagePaperHandle } from './contact/MessagePaper'
import { GalleryClouds } from './gallery/GalleryClouds'

interface ContactRoomProps {
  showRoom: boolean
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

export function ContactRoom({ showRoom, isExiting }: ContactRoomProps) {
  /*
    房间级相机（审计 A3）：`contact.ts` 的 `entryPose` 此前无人消费，相机停在门口，
    码头 / 留言纸 / 灯塔全挤在远处。与 About 一起接线，截图标定见 PR 说明。
  */
  const rootRef = useRef<THREE.Group>(null)
  useRoomCamera('contact', rootRef, { showRoom, isExiting })
  const { unlockAchievement } = useAchievementActions()
  const { locale } = useLocale()
  const links = getContactRoomLinks(locale)
  /*
    教程不在这里调了 —— `RoomInterior` 从注册表读 `RoomDefinition.tutorial` 并统一调
    （ADR 20260903211338）。原先四个房间各自硬编码教程 id 与作用域字面量，
    而 `tutorial` 字段零消费者；写错成别的房间的 id 不会有任何症状。
  */

  const waveRefs     = useRef<(THREE.Mesh | null)[]>([])
  const statekRef    = useRef<THREE.Mesh>(null)
  // MESSAGE 桶点击时聚焦到留言纸（见下方 SocialBarrel 的 onClick）
  const messagePaperRef = useRef<MessagePaperHandle>(null)

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

  useFrame((state) => {
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
    <group ref={rootRef} position={[0, -0.7, -5]}>
      {/* 环境音见 AboutRoom 同处注释 */}

      {/*
        海上的云。

        原先这里是四个 `planeGeometry + meshBasicMaterial color="#ffffff"`
        ——**没有贴图**，于是天空里飘着四个灰色矩形（审计 A2）。云纹理一直在
        仓库里（`CLOUD_TEXTURES`，8 张），About 与 Publications 都在用，只有
        `ROOM_ASSETS.contact` 没收它们。

        修法是复用 GalleryClouds（带漂移、billboard、原始宽高比处理），而不是
        在这里再手搓一份贴图逻辑。海景的云比 Publications 的城市屋顶低，所以
        显式给了 yRange / zRange。
      */}
      <GalleryClouds
        count={10}
        seed={7}
        yRange={[2.5, 6.5]}
        zRange={[-8, -22]}
        baseWidth={3.5}
        startX={30}
        endX={-30}
      />

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
        onClick={() => { window.open(links.linkedin, '_blank'); unlockAchievement('contact_found') }}
      />
      <SocialBarrel
        position={isMobile ? [-1.5, -0.3, -7] : [-5, -0.3, -8]}
        rotation={[0, 0.3, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="GITHUB"
        onClick={() => { window.open(links.github, '_blank'); unlockAchievement('contact_found') }}
      />
      <SocialBarrel
        position={isMobile ? [1.2, 0.5, -10] : [3, 0.5, -10]}
        rotation={[0, -0.2, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="EMAIL"
        onClick={() => { window.open(links.emailMailto, '_blank'); unlockAchievement('contact_found') }}
      />
      {/*
        MESSAGE 桶：原先是 `onClick={() => {}}`——有可点击视觉与标签但点了
        毫无反应，用户会判断页面坏了（触屏无 hover 线索，更明显）。
        同场景已有留言纸，正确行为是聚焦到它。
      */}
      <SocialBarrel
        position={isMobile ? [1.5, -0.3, -7] : [5, -0.3, -8]}
        rotation={[0, -0.3, 0]}
        texturePath="/textures/contact/beczka.webp"
        label="MESSAGE"
        onClick={() => {
          messagePaperRef.current?.focusMessage()
          unlockAchievement('contact_found')
        }}
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
      <MessagePaper ref={messagePaperRef} position={[0, 0.07, 2]} onSend={() => unlockAchievement('contact_found')} />
    </group>
  )
}
