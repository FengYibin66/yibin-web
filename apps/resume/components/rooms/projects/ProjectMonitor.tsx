'use client'

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'

import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import { useLabLabels } from '@/hooks/useLabLabels'
import { HAND_FONT, HAND_FONT_FILE, INK } from '@/lib/lab/domain/sketch/types'
import { MONITOR_RING, monitorTransform, SCREEN_GLOW } from '@/lib/lab/domain/rooms/projects/scene'
import type { ProjectRoomItem } from '@/lib/content/projectsRoom'

/**
 * 一块项目显示器。
 *
 * ## 与原实现的差别
 *
 * 原 `MonitorBlock` 无条件声明 **26 个** `useTexture` loader（显示器 6 面 ×
 * sketch/painted + 电视 6 面 + 手机 6 面），因为 hooks 不能条件调用而载体
 * 是运行时决定的。平台隐喻去掉后只剩一种载体，6 面 × 2 = 12 张，而且
 * 这一批本来就在 `RoomDefinition.assets` 里预载过（同一批纹理，全部显示器
 * 共用，`useTexture` 内部按 URL 缓存）。
 *
 * ## sketch → painted 的显形
 *
 * 沿用走廊线稿的语言：默认是铅笔线稿，hover 时那一面淡出到彩绘版。这里用
 * 两层平面 + 透明度交叉淡入，而不是 `RevealMaterial` 的噪声擦除着色器——
 * 六个面各一套 shader uniform 的管理成本远大于收益，而观感差别在 1.4 单位
 * 宽的板子上看不出来。
 */

const FACE_TEXTURES = [
  '/textures/studio/monitor_right.webp',
  '/textures/studio/monitor_right_painted.webp',
  '/textures/studio/monitor_left.webp',
  '/textures/studio/monitor_left_painted.webp',
  '/textures/studio/monitor_top.webp',
  '/textures/studio/monitor_top_painted.webp',
  '/textures/studio/monitor_bottom.webp',
  '/textures/studio/monitor_bottom_painted.webp',
  '/textures/studio/monitor_front.webp',
  '/textures/studio/monitor_front_painted.webp',
  '/textures/studio/monitor_back.webp',
  '/textures/studio/monitor_back_painted.webp',
] as const

export interface ProjectMonitorProps {
  item: ProjectRoomItem
  index: number
  count: number
  /** 是否是当前停靠的那一块 */
  isSelected: boolean
  /** 有别的块被停靠了 —— 本块该压暗退让 */
  isDimmed: boolean
  onSelect: (index: number) => void
}

export function ProjectMonitor({
  item,
  index,
  count,
  isSelected,
  isDimmed,
  onSelect,
}: ProjectMonitorProps) {
  const maps = useTexture([...FACE_TEXTURES])
  const labels = useLabLabels()
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const paintedRef = useRef<THREE.MeshStandardMaterial[]>([])
  const revealRef = useRef(0)

  const { position, rotationY } = useMemo(
    () => monitorTransform(index, count),
    [index, count],
  )

  /**
   * `BoxGeometry` 的材质顺序是 +X, −X, +Y, −Y, +Z, −Z。
   * `FACE_TEXTURES` 按这个顺序成对排列（sketch, painted）。
   */
  const faces = useMemo(() => {
    const out: { sketch: THREE.Texture; painted: THREE.Texture }[] = []
    for (let i = 0; i < 6; i += 1) {
      out.push({ sketch: maps[i * 2]!, painted: maps[i * 2 + 1]! })
    }
    return out
  }, [maps])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    // 显形进度：hover 或停靠时趋近 1
    const target = hovered || isSelected ? 1 : 0
    const speed = 1 - Math.pow(0.002, delta)
    revealRef.current = THREE.MathUtils.lerp(revealRef.current, target, speed)
    for (const material of paintedRef.current) {
      if (material) material.opacity = revealRef.current
    }

    // 停靠时略微前移 + 抬高，暗示"它被拿到眼前了"
    const lift = isSelected ? 0.1 : hovered ? 0.04 : 0
    group.position.y = THREE.MathUtils.lerp(group.position.y, position[1] + lift, speed)
  })

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerOver={e => {
        e.stopPropagation()
        if (isDimmed) return
        setHovered(true)
        document.body.style.cursor = 'pointer'
        audioMixer.play('door_hover', { volume: 0.35 })
      }}
      onPointerOut={e => {
        e.stopPropagation()
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
      onClick={e => {
        e.stopPropagation()
        onSelect(index)
      }}
    >
      {/* 机身：线稿层 */}
      <mesh castShadow>
        <boxGeometry args={[MONITOR_RING.width, MONITOR_RING.height, MONITOR_RING.depth]} />
        {faces.map((face, i) => (
          <meshStandardMaterial
            key={`sketch-${i}`}
            attach={`material-${i}`}
            map={face.sketch}
            roughness={0.85}
            opacity={isDimmed ? 0.45 : 1}
            transparent={isDimmed}
          />
        ))}
      </mesh>

      {/* 彩绘层：略大一点包在外面，透明度由 revealRef 驱动 */}
      <mesh scale={1.004}>
        <boxGeometry args={[MONITOR_RING.width, MONITOR_RING.height, MONITOR_RING.depth]} />
        {faces.map((face, i) => (
          <meshStandardMaterial
            key={`painted-${i}`}
            attach={`material-${i}`}
            map={face.painted}
            roughness={0.8}
            transparent
            opacity={0}
            ref={(material: THREE.MeshStandardMaterial | null) => {
              if (material) paintedRef.current[i] = material
            }}
          />
        ))}
      </mesh>

      {/* 屏幕的冷光 */}
      <pointLight
        position={[0, 0, MONITOR_RING.depth / 2 + SCREEN_GLOW.forwardOffset]}
        color={SCREEN_GLOW.color}
        intensity={isDimmed ? SCREEN_GLOW.intensity * 0.4 : SCREEN_GLOW.intensity}
        distance={SCREEN_GLOW.distance}
        decay={2}
      />

      {/* 屏幕上的项目名。手写体，与便签同一款 */}
      <Text
        position={[0, 0.05, MONITOR_RING.depth / 2 + 0.008]}
        fontSize={0.07}
        maxWidth={MONITOR_RING.width * 0.78}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={INK}
        // drei 的 Text 需要字体文件 URL，不吃 CSS 族名。
        // 必须是 ttf/otf/woff——troika 不支持 woff2（见 globals.css 的注释）
        font={HAND_FONT_FILE}
      >
        {item.title}
      </Text>
      <Text
        position={[0, -0.065, MONITOR_RING.depth / 2 + 0.008]}
        fontSize={0.042}
        maxWidth={MONITOR_RING.width * 0.8}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#6b5b3e"
        font={HAND_FONT_FILE}
      >
        {item.sub}
      </Text>

      {/*
        停靠后的出口：只在有 `url` 时出现。

        ADR 20260903140616 把「点一下」统一成停靠，原实现的 `window.open` 被替掉
        ——那一步是对的。但 `url` 一路带到这里却没人消费，有链接的项目停靠后也
        无路可去（2026-09-06 实机反馈「点了没跳转」）。出口放在屏幕底部、
        停靠态才出现：浏览态点一下仍是停靠，语义不变；没有 url 就不画，
        不做没有目的地的承诺（与 Classic 项目卡同一条原则）。
        `stopPropagation` 是必须的：不拦的话冒泡到房间根会触发 `dismiss` 收回。
      */}
      {isSelected && item.url ? (
        <Text
          data-testid="monitor-visit"
          position={[0, -0.24, MONITOR_RING.depth / 2 + 0.008]}
          fontSize={0.05}
          anchorX="center"
          anchorY="middle"
          color="#1f6f8b"
          font={HAND_FONT_FILE}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            window.open(item.url, '_blank', 'noopener,noreferrer')
          }}
          onPointerOver={(e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
        >
          {labels.hints.visitProject}
        </Text>
      ) : null}
    </group>
  )
}

/** 供 RoomDefinition.assets 派生用 */
ProjectMonitor.textures = FACE_TEXTURES

/** CSS 族名（供 DOM 层引用同一款字体） */
export const MONITOR_FONT_STACK = HAND_FONT
