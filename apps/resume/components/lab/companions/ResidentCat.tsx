'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

import { useAudio } from '@/context/AudioContext'
import { getRail, useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import { say } from '@/lib/lab/app/stores/speechStore'
import { CAT_WAKE_DISTANCE, nextCatState, type CatState } from '@/lib/lab/domain/corridor/companion'
import { useAchievementActions } from '@/context/AchievementsContext'
import { useMotionScale } from '@/hooks/useMotionScale'
import { SpeechBubble } from './SpeechBubble'
import { useCatEyes } from './useCatEyes'

/**
 * 走廊尽头打盹的猫（ADR 20260908160918 的第一只活物）。
 *
 * ## 它在哪、为什么在那
 *
 * 走廊第 0 段的尽头（relativeZ −68），侧道上打盹。位置从地标表读
 * （`resident-cat`）。
 *
 * 原设计是让它坐在柜顶守着那个相框（`beloved.jpg`），叙事更好 —— 但实测那个
 * 位置**永远看不见**：柜子在 −49、Gallery 门在 −44，相机走到能看见柜子的距离时
 * 门段的翻板已经转过来把它挡住了。理由与取舍写在地标表那一项的注释里。
 *
 * ## 三个状态，零新素材
 *
 * 复用入口页那只猫的身体纹理（`cat_body.webp`）：
 *
 * - `sleep`（默认）：瞳孔隐藏，眼睛是**两条细横线**（闭眼）；身体轻微起伏
 * - `awake`（相机靠近）：瞳孔出现并跟着指针转
 * - `stretch`（被点）：身体纵向拉伸一下弹回，头顶冒一句"……喵"，解锁成就
 *
 * 闭眼用两条线画而不是另出一张睡姿线稿：这个仓库的活物一律是带 alpha 的
 * 手绘平面（ADR 20260908160918），而"再要一张图"就意味着要有人去画。
 * 两条 0.003 高的黑线在线稿风里完全成立，且省掉一次素材流水线往返。
 *
 * ## 距离判断带滞回
 *
 * 8 单位内醒、12 单位外睡（`domain/corridor/companion.ts`）。两个阈值不同是
 * 刻意的：单阈值会让人站在临界点上时猫反复睁眼闭眼。
 *
 * ## 第二圈
 *
 * lap ≥ 1 时它一开始就是醒的，玩家走进 8 单位说一句"又是你"（每圈一次）——
 * 走廊记得你来过（规格 lab-corridor-story.md §4）。
 */

/**
 * 猫身平面的边长（世界单位）。
 *
 * 0.45 试过，太小：走廊高 3.5，猫在 6 单位外只有约 30 像素高，看起来是地板上
 * 的一个白点而不是一只猫（实机截图）。0.7 能辨认轮廓但验收时仍嫌小。
 * 1.15 让它在 6 单位外约 80 像素高——一眼就是一只猫，又明显小于人
 * （`Avatar` 高 2.3，约为猫的两倍）。
 */
const CAT_SIZE = 1.35
/** 相对入口页那只（1.5 见方）的比例，瞳孔位置与跟随幅度都按它缩放 */
const SCALE = CAT_SIZE / 1.5

/** 走廊几何（与 `CorridorGeometry` 同源） */
const FLOOR_Y = -1.75
/**
 * 猫离走廊中线的距离。
 *
 * 走廊半宽 3.5。贴墙（±3.24，家具那个位置）会让猫在近距离时落到视锥外面
 * —— 相机在中线、水平半视角 46°，横向 3.24 单位要在 3.1 单位以外才进画，
 * 而那个距离上门的翻板已经转过来挡住了。1.9 足够靠侧不挡路，又一直在画面里；
 * 猫身内缘落在 1.9 − 1.15/2 ≈ 1.3，仍在中央视带 (−0.6, 0.6) 之外。
 */
const LANE_X = 1.9
/** 猫身平面里，猫的脚底约在下缘往上 15% 处 —— 让脚踩在地板上而不是埋进去 */
const FOOT_OFFSET = CAT_SIZE * 0.5 - CAT_SIZE * 0.15

const STRETCH_DURATION = 0.8

/**
 * 气泡尾巴尖所在的高度。猫的线稿在 1.15 见方的平面里只占中下部，耳朵尖大约在
 * 中心往上 0.4 × 边长处——按平面顶边（0.5）放会让气泡悬在半空（实机截图）。
 */
const BUBBLE_ANCHOR_Y = CAT_SIZE * 0.4

/* CatState 与三态的切换规则都在 domain（`corridor/companion.ts`），这里只渲染 */

interface ResidentCatProps {
  /** 猫所在的世界 z（由 `CorridorSegment` 从地标表算出） */
  z: number
  /** 猫所在的墙面 */
  side: 'left' | 'right'
}

export function ResidentCat({ z, side }: ResidentCatProps) {
  const { unlockAchievement } = useAchievementActions()
  const { play } = useAudio()
  const motionScale = useMotionScale()

  const bodyTex = useTexture('/textures/corridor/cat_body.webp')
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const leftPupilRef = useRef<THREE.Mesh>(null)
  const rightPupilRef = useRef<THREE.Mesh>(null)

  // 第二圈起它是醒着的（挂载时读一次；圈数在猫可见期间不会变）
  const [state, setState] = useState<CatState>(() =>
    useCorridorStore.getState().lap >= 1 ? 'awake' : 'sleep',
  )
  const stateRef = useRef<CatState>(state)
  stateRef.current = state
  /** 这一圈打过招呼了吗（每圈一次） */
  const greetedLap = useRef(-1)

  /*
    把状态写到根元素上（`html[data-lab-cat]`）。

    猫是 R3F 的 mesh，**不在 DOM 里** —— 没有这个属性，"靠近它会醒吗"就只能靠
    在截图里找一只猫，而它在正对柜子时恰好落在视野边缘外。实测排查这件事时就
    卡在这里。

    用 dataset 而不是往 store 加字段：`lib/animations/scrollReveal.ts` 的
    `data-reveal-arrival` 是同一个先例，E2E 与巡检都能直接读，且不给世界状态
    增加一个只为观测存在的字段。
  */
  useEffect(() => {
    document.documentElement.dataset.labCat = state
    return () => {
      delete document.documentElement.dataset.labCat
    }
  }, [state])

  const awake = state !== 'sleep'
  useCatEyes(
    { left: leftPupilRef, right: rightPupilRef },
    {
      left: [-0.075 * SCALE, 0.28 * SCALE],
      right: [0.043 * SCALE, 0.28 * SCALE],
      gain: SCALE,
    },
    awake,
  )

  /*
    醒 / 睡的切换 + 呼吸。

    距离读的是**世界状态里的导轨 z**（`getRail()`，每帧读不订阅），而不是
    `camera.position.z` —— 走廊里两者相同，但导轨才是"玩家在哪"的单一来源
    （ADR 20260908172231）。
  */
  useFrame(state3 => {
    const distance = getRail().z - z
    const next = nextCatState(stateRef.current, distance)
    if (next !== stateRef.current) setState(next)

    // 第二圈：走近时说一句"又是你"（每圈一次；规则层会再按冷却与互斥过滤）
    const lap = useCorridorStore.getState().lap
    if (lap >= 1 && greetedLap.current !== lap && Math.abs(distance) <= CAT_WAKE_DISTANCE) {
      greetedLap.current = lap
      say({ speaker: 'cat', key: 'catAgain', priority: 2 })
    }

    // 睡着时的呼吸起伏。伸懒腰期间不要碰 scale —— 那是 gsap 在写
    const body = bodyRef.current
    if (!body || stateRef.current === 'stretch') return
    if (motionScale === 0) {
      body.scale.y = 1
      return
    }
    body.scale.y = 1 + Math.sin(state3.clock.elapsedTime * 1.1) * 0.02
  })

  /*
    伸懒腰。gsap 的创建物归 `gsap.context()` 所有、cleanup 只 revert 自己的
    （ADR 20260907120701）—— 卸载时若不撤销，tween 会继续写一个已卸载的对象。
  */
  const ctxRef = useRef<gsap.Context | null>(null)
  useEffect(() => {
    ctxRef.current = gsap.context(() => {})
    return () => {
      ctxRef.current?.revert()
      ctxRef.current = null
    }
  }, [])

  const x = side === 'left' ? -LANE_X : LANE_X

  const handleClick = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation()
      if (stateRef.current === 'stretch') return

      unlockAchievement('pet_cat')
      // 一句"……喵"走统一的气泡规则（互斥 / 冷却 / 优先级）；叫声从猫的位置发出
      say({ speaker: 'cat', key: 'catStretch', priority: 3 })
      play('cat_meow', { position: [x, FLOOR_Y + FOOT_OFFSET, z] })

      /*
        `prefers-reduced-motion` 下**跳过动画但保留反馈**：成就照解、字照冒。
        减少动效不该把内容拿走（ADR 20260908172231）。
      */
      if (motionScale === 0) return

      const body = bodyRef.current
      if (!body) return
      setState('stretch')
      ctxRef.current?.add(() => {
        gsap.fromTo(
          body.scale,
          { y: 1 },
          {
            y: 1.15,
            duration: STRETCH_DURATION * 0.4,
            ease: 'power2.out',
            yoyo: true,
            repeat: 1,
            onComplete: () => {
              body.scale.y = 1
              setState('awake')
            },
          },
        )
        gsap.fromTo(
          body.rotation,
          { z: 0 },
          { z: 0.07, duration: STRETCH_DURATION * 0.5, ease: 'power1.inOut', yoyo: true, repeat: 1 },
        )
      })
    },
    [motionScale, unlockAchievement, play, x, z],
  )

  /** 稍微转向走廊中央，别让猫的侧面正对着墙 */
  const rotationY = side === 'left' ? -0.35 : 0.35

  return (
    <group
      ref={groupRef}
      position={[x, FLOOR_Y + FOOT_OFFSET, z]}
      rotation={[0, rotationY, 0]}
    >
      {/*
        脚下的接触阴影。

        没有它，白色线稿的猫贴在白色地板上会像**一张贴纸**——这正是 HN 对
        "My Room in 3D" 的那条批评（椅子会动而阴影不动）。走廊全是
        `meshBasicMaterial`（不参与光照），所以阴影只能是一块手画的淡色椭圆，
        平铺在地板上略高一点避免 z-fighting。
      */}
      {/* 一块比猫稍大的浅色地面晕：走廊尽头被雾推成纯白，没有它 15 单位外看不出"那里有东西" */}
      <mesh position={[0, -FOOT_OFFSET + 0.006, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.5, 1]}>
        <circleGeometry args={[CAT_SIZE * 0.9, 32]} />
        <meshBasicMaterial color="#cfcabb" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh
        position={[0, -FOOT_OFFSET + 0.01, 0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, 0.42, 1]}
      >
        <circleGeometry args={[CAT_SIZE * 0.36, 24]} />
        <meshBasicMaterial color="#c8c4b0" transparent opacity={0.32} depthWrite={false} />
      </mesh>

      <group ref={bodyRef} onClick={handleClick}>
        <mesh>
          <planeGeometry args={[CAT_SIZE, CAT_SIZE]} />
          <meshBasicMaterial map={bodyTex} transparent alphaTest={0.01} depthWrite={false} />
        </mesh>

        {/* 睡着：两条细横线当闭着的眼睛 */}
        <mesh position={[-0.075 * SCALE, 0.28 * SCALE, 0.01]} visible={!awake}>
          <planeGeometry args={[0.055 * SCALE, 0.012 * SCALE]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh position={[0.043 * SCALE, 0.28 * SCALE, 0.01]} visible={!awake}>
          <planeGeometry args={[0.055 * SCALE, 0.012 * SCALE]} />
          <meshBasicMaterial color="black" />
        </mesh>

        {/* 醒着：瞳孔跟着指针转（与入口页那只共用 useCatEyes） */}
        <mesh ref={leftPupilRef} position={[-0.075 * SCALE, 0.28 * SCALE, 0.01]} visible={awake}>
          <circleGeometry args={[0.02 * SCALE, 24]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh ref={rightPupilRef} position={[0.043 * SCALE, 0.28 * SCALE, 0.01]} visible={awake}>
          <circleGeometry args={[0.02 * SCALE, 24]} />
          <meshBasicMaterial color="black" />
        </mesh>
      </group>

      {/* 头顶那一行字：规则在 speech.ts，画在 SpeechBubble */}
      <SpeechBubble speaker="cat" anchorY={BUBBLE_ANCHOR_Y} />
    </group>
  )
}
