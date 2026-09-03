'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { INK } from '@/lib/lab/domain/sketch/types'
import {
  CABINET,
  CABINET_LAMPS,
  CABLES,
  DESK,
  DESK_TAPES,
  DIALS,
  LAMP,
  WHITEBOARD,
  WHITEBOARD_DIAGRAM,
  cabinetLampPosition,
} from '@/lib/lab/domain/rooms/projects/scene'

import { SketchPanel, WallSketch } from './SketchPanel'

/**
 * 房间陈设 —— 全部由 `domain/rooms/projects/scene.ts` 的声明驱动。
 *
 * 这个文件里没有一个坐标常量：位置、尺寸、灯位都来自声明，组件只负责画。
 * 加一块墙面装饰是往声明里加一项，不是往这里加 JSX。
 */

// ─── 环形工作台 ──────────────────────────────────────────────────────────────

export function Desk() {
  /**
   * 带缺口的环。
   *
   * `RingGeometry` 原生支持 thetaStart/thetaLength，所以缺口不用自己搓
   * 几何——把缺口对准 +Z（朝门）即可。三角化交给 three。
   */
  const geometry = useMemo(() => {
    const start = Math.PI / 2 + DESK.gap / 2
    const length = Math.PI * 2 - DESK.gap
    return new THREE.RingGeometry(
      DESK.innerRadius,
      DESK.outerRadius,
      64,
      1,
      start,
      length,
    )
  }, [])

  return (
    <group position={[0, DESK.y, 0]}>
      {/* 台面 */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#c9b896" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* 台沿：给厚度，否则从侧面看是一张纸 */}
      <mesh position={[0, -DESK.thickness / 2, 0]}>
        <cylinderGeometry
          args={[DESK.outerRadius, DESK.outerRadius, DESK.thickness, 64, 1, true]}
        />
        <meshStandardMaterial color="#a89578" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* 胶带标签，贴在台沿上 */}
      {DESK_TAPES.map(tape => {
        const r = DESK.outerRadius + 0.005
        return (
          <group
            key={tape.id}
            position={[Math.sin(tape.angle) * r, 0, Math.cos(tape.angle) * r]}
            rotation={[0, tape.angle, 0]}
          >
            <SketchPanel spec={tape.sketch} width={0.46} height={0.1} />
          </group>
        )
      })}
    </group>
  )
}

// ─── 台灯 ────────────────────────────────────────────────────────────────────

/**
 * 台灯：房间的主光源。
 *
 * 灯本身要能看见（一个发光的灯罩），否则光"从空气里来"。灯罩用
 * `meshBasicMaterial` + `toneMapped={false}`，这样它不受自己的光影响，
 * 看起来是在发光而不是被照亮。
 */
export function DeskLamp() {
  const [x, y, z] = LAMP.position
  return (
    <group>
      <pointLight
        position={[x, y, z]}
        color={LAMP.color}
        intensity={LAMP.intensity}
        distance={LAMP.distance}
        decay={2}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      {/* 灯罩 */}
      <mesh position={[x, y, z]}>
        <coneGeometry args={[LAMP.shadeRadius, LAMP.shadeRadius * 1.15, 16, 1, true]} />
        <meshBasicMaterial color={LAMP.color} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* 灯杆 */}
      <mesh position={[x, (y + LAMP.baseY) / 2, z]}>
        <cylinderGeometry args={[0.018, 0.018, y - LAMP.baseY, 8]} />
        <meshStandardMaterial color={INK} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* 底座 */}
      <mesh position={[x, LAMP.baseY, z]}>
        <cylinderGeometry args={[0.13, 0.15, 0.03, 20]} />
        <meshStandardMaterial color={INK} roughness={0.7} />
      </mesh>
    </group>
  )
}

// ─── 机柜 ────────────────────────────────────────────────────────────────────

const LAMP_COLORS = ['#7dff9b', '#7dff9b', '#ffd166'] as const

/**
 * 机柜：草图纹理 + 叠在灯位上的发光小平面。
 *
 * 为什么分两层：草图里画的是**墨线圆圈**（静态纹理的一部分，roughjs 生成后
 * 缓存），发光的是每帧变的小平面。两者位置必须对齐——`CABINET_LAMPS` 与
 * `planCabinet` 各算一遍，`__tests__/projectsScene.test.ts` 断言它们一致。
 *
 * 呼吸用固定周期 + 每盏不同相位，而不是随机：随机每帧变会闪，且没法测。
 */
export function ServerCabinet() {
  const lampsRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const group = lampsRef.current
    if (!group) return
    const t = clock.getElapsedTime()
    for (const [i, child] of group.children.entries()) {
      const mesh = child as THREE.Mesh
      const material = mesh.material as THREE.MeshBasicMaterial
      // 每盏一个不同的周期与相位，凑出"各自忙各自的"
      const phase = i * 1.7
      const speed = 1.1 + (i % 5) * 0.37
      material.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * speed + phase))
    }
  })

  return (
    <group>
      <WallSketch panel={CABINET} />
      <group ref={lampsRef}>
        {CABINET_LAMPS.map((lampUv, i) => (
          <mesh
            key={i}
            position={cabinetLampPosition(lampUv)}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <circleGeometry args={[0.026, 10]} />
            <meshBasicMaterial
              color={LAMP_COLORS[i % LAMP_COLORS.length]}
              transparent
              opacity={0.6}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ─── 其余墙面陈设 ────────────────────────────────────────────────────────────

export function WallDecor() {
  return (
    <group>
      <WallSketch panel={WHITEBOARD} />
      <WallSketch panel={WHITEBOARD_DIAGRAM} />
      {DIALS.map(dial => <WallSketch key={dial.id} panel={dial} />)}
      {CABLES.map(cable => <WallSketch key={cable.id} panel={cable} />)}
    </group>
  )
}
