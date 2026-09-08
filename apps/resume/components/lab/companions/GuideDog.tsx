'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

import { useAudio } from '@/context/AudioContext'
import { useAchievementActions } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useMotionScale } from '@/hooks/useMotionScale'
import { getRail, useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import { say } from '@/lib/lab/app/stores/speechStore'
import { ARRIVE_S, DOG_LANE_X, DOG_LEAD, INITIAL_DOG, stepDog, type DogInput, type DogSnapshot } from '@/lib/lab/domain/corridor/dog'
import {
  DOG_PART_FILES,
  DOG_SIDE_FOOT_V,
  DOG_SIDE_PARTS,
  DOG_SIT_FOOT_V,
  type DogSidePart,
} from '@/lib/lab/domain/corridor/dogParts.mjs'
import { doorForRoom, doorWorldZ, segmentIndexAtZ } from '@/lib/lab/domain/corridor/layout'
import { nearestDoorAhead } from '@/lib/lab/domain/corridor/world'
import { SpeechBubble } from './SpeechBubble'

/**
 * 引路的小狗（ADR 20260908160918，规格 lab-companions.md §2）。
 *
 * 行为全在 `domain/corridor/dog.ts` 的 reducer 里；这里每帧：读导轨、读进房
 * 相位、算前方最近门在哪面墙 → `stepDog` → 把快照写到几个 Object3D 上，并把
 * reducer 吐出的事件翻成副作用（爪音、叫声、一句话、成就）。
 *
 * 纸偶：五个部件各是一张与画布同尺寸的透明平面，叠在一起、各自绕
 * `dogParts.mjs` 声明的枢轴转。不裁切、不做骨骼——腿的摆动就是一个
 * `rotation.z = sin(legPhase)`，而 `legPhase` 随**位移**推进，所以不滑步。
 *
 * 它挂在 `LabScene` 而不是某一段 `CorridorSegment` 里：狗跟着玩家跨段走，
 * 不属于任何一段，所以也**不在地标表里**（地标表的 schema 要求条目有段内位置，
 * 一只会动的狗没有）；成就 `dog_companion` 用 `corridor-companion` trigger 引用它。
 */

/** 纸偶画布映射到的世界边长（与猫同级；站高约 0.6，见 dogParts 的 FOOT_V） */
const DOG_SIZE = 1.15
const FLOOR_Y = -1.75
/**
 * 画布中心到脚底的距离。脚底在画布中心**下方** (FOOT_V − 0.5) × 边长处，
 * 所以要让脚踩在地板上，画布中心得放在 FLOOR_Y **上方**这么多。
 * 第一版写成了减号，狗整个埋在地板下面，三张巡检截图里一只都没有。
 */
const SIDE_FOOT_OFFSET = (DOG_SIDE_FOOT_V - 0.5) * DOG_SIZE
const SIT_FOOT_OFFSET = (DOG_SIT_FOOT_V - 0.5) * DOG_SIZE

const LEG_SWING = 0.5
const TAIL_SWING = 0.25

const SIDE_PART_IDS = Object.keys(DOG_SIDE_PARTS) as DogSidePart[]

const partUrl = (file: string) => `/textures/corridor/companion/${file}.webp`
/** 五个部件 + 坐姿，顺序与 SIDE_PART_IDS 一致；模块级，别每次渲染重建 */
const PART_URLS = SIDE_PART_IDS.map(id => partUrl(DOG_PART_FILES[id])).concat(partUrl(DOG_PART_FILES.sit))
/** 叫声定位用的临时数组：每帧只写不新建 */
const _worldPos: [number, number, number] = [0, 0, 0]

/** 一个绕枢轴转的部件：父组在枢轴处，子网格反向偏移 */
function Part({
  tex,
  pivot,
  groupRef,
  z,
}: {
  tex: THREE.Texture
  pivot: readonly [number, number]
  groupRef: React.RefObject<THREE.Group | null>
  z: number
}) {
  const px = (pivot[0] - 0.5) * DOG_SIZE
  const py = (0.5 - pivot[1]) * DOG_SIZE
  return (
    <group ref={groupRef} position={[px, py, z]}>
      <mesh position={[-px, -py, 0]}>
        <planeGeometry args={[DOG_SIZE, DOG_SIZE]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function GuideDog() {
  const motionScale = useMotionScale()
  const { play } = useAudio()
  const { unlockAchievement, showTutorial } = useAchievementActions()
  const { roomLoadState } = useScene()
  /*
    前导距离随宽高比：竖屏时水平视场收窄，5 单位处横向可见半宽只有 1.33 < 侧道 1.4，
    狗的中心出画（UX 评审）。按 tan(fov/2)·aspect 反解，让狗中心 + 0.6 的余量在画内；桌面仍是 5。
  */
  const aspect = useThree(s => s.viewport.aspect)
  const lead = Math.max(DOG_LEAD, (DOG_LANE_X + 0.6) / (Math.tan(Math.PI / 6) * aspect))

  const textures = useTexture(PART_URLS)
  const sideTex = useMemo(
    () => Object.fromEntries(SIDE_PART_IDS.map((id, i) => [id, textures[i]!])) as Record<DogSidePart, THREE.Texture>,
    [textures],
  )
  const sitTex = textures[textures.length - 1]!

  /*
    进房目标门：相位离开 idle 就有目标；由 `SceneContext` 的房间加载状态派生，
    放进 ref 给 useFrame 读——它一次进出房才变两次。
  */
  const doorRef = useRef<DogInput['doorTarget']>(null)
  /** 进房失败：目标门消失但玩家没进去，狗不该打招呼 */
  const abortedRef = useRef(false)
  useEffect(() => {
    const { phase, roomId, segmentIndex } = roomLoadState
    abortedRef.current = phase === 'failed'
    if (phase === 'idle' || phase === 'failed' || !roomId) {
      doorRef.current = null
      return
    }
    const door = doorForRoom(roomId)
    const seg = segmentIndex ?? segmentIndexAtZ(getRail().z)
    doorRef.current = { z: doorWorldZ(door.slot, seg), side: door.side }
  }, [roomLoadState])

  const rootRef = useRef<THREE.Group>(null)
  const sideRef = useRef<THREE.Group>(null)
  const sitRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const legFrontRef = useRef<THREE.Group>(null)
  const legBackRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const splashRef = useRef<THREE.Mesh>(null)

  const snapRef = useRef<DogSnapshot>(INITIAL_DOG)
  const pawToggle = useRef<'a' | 'b'>('a')

  useEffect(() => () => {
    delete document.documentElement.dataset.labDog
  }, [])

  useFrame((_, delta) => {
    const rail = getRail()
    const lap = useCorridorStore.getState().lap
    const ahead = nearestDoorAhead(rail.z)
    const r = stepDog(snapRef.current, {
      camZ: rail.z,
      camV: rail.velocity,
      doorTarget: doorRef.current,
      nextDoorSide: ahead?.landmark.kind === 'door' ? ahead.landmark.side : null,
      reducedMotion: motionScale === 0,
      lap,
      dt: delta,
      doorAborted: abortedRef.current,
      lead,
    })
    const s = r.next
    snapRef.current = s

    const footOffset = s.posture === 'sit' ? SIT_FOOT_OFFSET : SIDE_FOOT_OFFSET
    const centerY = FLOOR_Y + footOffset
    _worldPos[0] = s.x
    _worldPos[1] = centerY
    _worldPos[2] = s.z

    for (const ev of r.events) {
      switch (ev.type) {
        case 'paw':
          play(pawToggle.current === 'a' ? 'paw_a' : 'paw_b', { volume: 0.35 })
          pawToggle.current = pawToggle.current === 'a' ? 'b' : 'a'
          break
        case 'bark':
          play('dog_bark', { position: _worldPos })
          break
        case 'speech':
          say({ speaker: 'dog', key: ev.key, priority: 2 })
          break
        case 'achievement':
          unlockAchievement('dog_companion')
          break
        case 'arrived':
          // 狗登场那一刻提一句"继续走，小狗会跟着你"（作用域 corridor，进房整批出队）
          showTutorial('dog_companion', 'corridor')
          break
      }
    }

    /*
      诊断属性（E2E / 巡检读）。每帧与 DOM 上的当前值比对再写，而不是记"上次
      写过什么"：Suspense 在邻居加载时会把这棵子树隐藏再显示，cleanup 跑过一次
      属性就没了，而"上次写过"的 ref 还在——实测就丢过。
    */
    if (document.documentElement.dataset.labDog !== s.state) {
      document.documentElement.dataset.labDog = s.state
    }

    const root = rootRef.current
    if (!root) return
    root.visible = s.state !== 'offstage'
    if (!root.visible) return

    root.position.set(s.x, centerY + s.hop, s.z)
    // 稍微转向走廊中央，别让侧面正对着墙（与猫同一处理）
    root.rotation.y = s.x > 0 ? 0.35 : -0.35

    const sitting = s.posture === 'sit'
    if (sideRef.current) {
      sideRef.current.visible = !sitting
      sideRef.current.scale.x = s.facing
      sideRef.current.rotation.z = s.lean * s.facing
    }
    if (sitRef.current) sitRef.current.visible = sitting

    const swing = Math.sin(s.legPhase) * LEG_SWING
    if (legFrontRef.current) legFrontRef.current.rotation.z = swing
    if (legBackRef.current) legBackRef.current.rotation.z = -swing
    if (tailRef.current) tailRef.current.rotation.z = Math.sin(s.tailPhase) * TAIL_SWING
    if (headRef.current) headRef.current.rotation.z = s.headTilt

    // 地板在根组坐标里的高度（根组随 hop 上下，阴影要留在地板上）
    const floorLocal = -footOffset - s.hop + 0.01

    // 接触阴影：跳起来时缩小
    if (shadowRef.current) {
      const k = 1 - s.hop * 2.5
      shadowRef.current.scale.set(k, 0.42 * k, 1)
      shadowRef.current.position.y = floorLocal
    }

    // 登场那一圈墨点：arrive 前 0.4 s 扩散淡出（调研 §3.5，登场瞬间）
    if (splashRef.current) {
      const t = s.state === 'arrive' ? Math.min(1, s.stateTime / 0.4) : 1
      splashRef.current.visible = s.state === 'arrive' && t < 1 && s.stateTime < ARRIVE_S
      splashRef.current.position.y = floorLocal + 0.005
      const mat = splashRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 * (1 - t)
      const sc = 1 + t * 1.4
      splashRef.current.scale.set(sc, sc, 1)
    }
  })

  return (
    <group ref={rootRef} visible={false}>
      {/* 脚下的接触阴影（与猫同款：没有它白线稿贴白地板像贴纸） */}
      <mesh ref={shadowRef} position={[0, -SIDE_FOOT_OFFSET + 0.01, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.42, 1]}>
        <circleGeometry args={[DOG_SIZE * 0.3, 24]} />
        <meshBasicMaterial color="#c8c4b0" transparent opacity={0.32} depthWrite={false} />
      </mesh>

      {/* 登场墨点 */}
      <mesh ref={splashRef} visible={false} position={[0, -SIDE_FOOT_OFFSET + 0.015, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DOG_SIZE * 0.18, DOG_SIZE * 0.26, 32]} />
        <meshBasicMaterial color="#6b6b6b" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* 侧面站姿：五个部件按枢轴叠放。后腿最靠里，头与前腿最靠外 */}
      <group ref={sideRef}>
        <Part tex={sideTex['leg-back']} pivot={DOG_SIDE_PARTS['leg-back'].pivot} groupRef={legBackRef} z={0} />
        <Part tex={sideTex.tail} pivot={DOG_SIDE_PARTS.tail.pivot} groupRef={tailRef} z={0.002} />
        <Part tex={sideTex.body} pivot={DOG_SIDE_PARTS.body.pivot} groupRef={bodyRef} z={0.004} />
        <Part tex={sideTex['leg-front']} pivot={DOG_SIDE_PARTS['leg-front'].pivot} groupRef={legFrontRef} z={0.006} />
        <Part tex={sideTex.head} pivot={DOG_SIDE_PARTS.head.pivot} groupRef={headRef} z={0.008} />
      </group>

      {/* 坐姿正面：一张整图 */}
      <group ref={sitRef} visible={false}>
        <mesh>
          <planeGeometry args={[DOG_SIZE, DOG_SIZE]} />
          <meshBasicMaterial map={sitTex} transparent alphaTest={0.01} depthWrite={false} />
        </mesh>
      </group>

      {/* 头顶那一行字：耳朵尖大约在画布 v≈0.23 → 中心往上 0.27 边长 */}
      <SpeechBubble speaker="dog" anchorY={DOG_SIZE * 0.3} />
    </group>
  )
}
