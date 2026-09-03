'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

import {
  BACK_Z,
  CEILING_Y,
  FLOOR_Y,
  ROOM_DEPTH,
  ROOM_WIDTH,
  SHELL_TINT,
  WALL_X,
} from '@/lib/lab/domain/rooms/projects/scene'

/**
 * 房间外壳：地板、天花、三面墙。
 *
 * 纹理复用走廊的——这是**同一栋楼里的一间房**，用同一套材质是语义上正确的，
 * 顺带零新增下载（ADR 20260903140619 的预算约束）。
 *
 * 但走廊是亮的、这间是深夜的，所以每个材质带一个 `SHELL_TINT` 颜色乘子把
 * 同一张贴图压暗压暖，不必再做一套贴图。第一版没有这一层，实机看是大白天，
 * 连白板（纸白）都因为和墙面一个亮度而看不见。
 *
 * 原先这个房间**根本没有外壳**：`ROOM_ASSETS.projects` 里 28 张纹理全是
 * 显示器六面贴图，没有一张是环境（审计 A4）。于是塔浮在走廊的场景级雾里，
 * 15 单位外一律洗成米白。
 */
const SHELL_TEXTURES = [
  '/textures/corridor/wall_texture.webp',
  '/textures/corridor/ceiling_texture.webp',
  '/textures/corridor/kawalekpodlogi.webp',
] as const

export function LabShell() {
  const [wall, ceiling, floor] = useTexture([...SHELL_TEXTURES])

  /**
   * 墙面纹理平铺。
   *
   * 走廊那张砖墙是为 100 单位长的走廊做的，直接拉到 11 单位宽的墙上会
   * 明显变形。按世界尺寸算重复次数，砖块大小才和走廊里看到的一致。
   */
  const walls = useMemo(() => {
    const make = (repeatX: number, repeatY: number) => {
      const t = wall.clone()
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeatX, repeatY)
      t.needsUpdate = true
      return t
    }
    const height = CEILING_Y - FLOOR_Y
    // 走廊里砖墙大约 1 次重复 / 6 单位
    const perUnit = 1 / 6
    return {
      back: make(ROOM_WIDTH * perUnit, height * perUnit * 2),
      side: make(ROOM_DEPTH * perUnit, height * perUnit * 2),
    }
  }, [wall])

  const floorMap = useMemo(() => {
    const t = floor.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(ROOM_WIDTH / 4, ROOM_DEPTH / 4)
    t.needsUpdate = true
    return t
  }, [floor])

  const ceilingMap = useMemo(() => {
    const t = ceiling.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(ROOM_WIDTH / 5, ROOM_DEPTH / 5)
    t.needsUpdate = true
    return t
  }, [ceiling])

  const height = CEILING_Y - FLOOR_Y
  const midY = (CEILING_Y + FLOOR_Y) / 2

  return (
    <group>
      {/* 地板 */}
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={floorMap} color={SHELL_TINT.floor} roughness={0.92} />
      </mesh>

      {/* 天花 */}
      <mesh position={[0, CEILING_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={ceilingMap} color={SHELL_TINT.ceiling} roughness={0.95} />
      </mesh>

      {/* 后墙 */}
      <mesh position={[0, midY, BACK_Z]}>
        <planeGeometry args={[ROOM_WIDTH, height]} />
        <meshStandardMaterial map={walls.back} color={SHELL_TINT.wall} roughness={0.9} />
      </mesh>

      {/* 左墙 */}
      <mesh position={[-WALL_X, midY, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_DEPTH, height]} />
        <meshStandardMaterial map={walls.side} color={SHELL_TINT.wall} roughness={0.9} />
      </mesh>

      {/* 右墙 */}
      <mesh position={[WALL_X, midY, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_DEPTH, height]} />
        <meshStandardMaterial map={walls.side} color={SHELL_TINT.wall} roughness={0.9} />
      </mesh>

      {/*
        门那面（+Z）不画墙：观察者从那里进来，画上就把自己关在盒子里，
        而且 `cameraFreedom` 允许后退到 7.5 单位——那会穿到墙外看到背面。
        代价是往后看会看到"外面"，但 azimuth 只有 ±0.6，转不过去。
      */}
    </group>
  )
}

LabShell.textures = SHELL_TEXTURES
