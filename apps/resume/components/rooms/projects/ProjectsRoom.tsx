'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMachine } from '@xstate/react'
import * as THREE from 'three'

import { useAchievementActions } from '@/context/AchievementsContext'
import { useLocale } from '@/hooks/useLocale'
import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import { cameraDirector } from '@/lib/lab/app/camera/CameraDirector'
import { pushEscapeConsumer } from '@/lib/lab/app/escapeStack'
import { canBrowse, dockMachine, hasSelection } from '@/lib/lab/domain/machines/dock.machine'
import { getProjectRoomItems, stickyForProject } from '@/lib/content/projectsRoom'
import { projectsRoom } from '@/lib/lab/domain/rooms/projects'
import {
  AMBIENT,
  MONITOR_DOCK,
  ROOM_ORIGIN_Z,
  STICKY_SLOTS,
  monitorDockPose,
  toDoorFrame,
  wallPanelTransform,
} from '@/lib/lab/domain/rooms/projects/scene'

import { Desk, DeskLamp, ServerCabinet, WallDecor } from './LabFurniture'
import { LabShell } from './LabShell'
import { ProjectMonitor } from './ProjectMonitor'
import { SketchPanel } from './SketchPanel'
import { useRoomCamera } from '@/hooks/useRoomCamera'

/**
 * Projects —— 「深夜实验室」（ADR 20260903140619）。
 *
 * 取代原先的「无限下落的显示器塔」。原实现的问题不是塔本身，而是三层叠加
 * （审计 A4）：没有环境几何、相机取景在错误的坐标系、场景级雾从塔的距离
 * 开始洗白。三条各自都足以让画面「不对」。
 *
 * 这个版本的结构：
 *
 *   - **空间**由 `domain/rooms/projects/scene.ts` 声明。这个文件里没有坐标
 *     常量，只有组合。
 *   - **相机**由 `cameraDirector` 持有。本组件只在进房时给它 `entryPose`，
 *     停靠时给它 `monitorDockPose`——都是声明里的房间局部坐标，换算由
 *     director 用房间根的 worldMatrix 做（ADR 20260903140617）。
 *   - **交互**由 `dockMachine` 定义（ADR 20260903140616）。浏览 → 居中 →
 *     停靠 → 收回，与 Publications 共用同一台机器，所以两个房间里"点一下"
 *     的含义一致。原实现里 Projects 点击直接 `window.open`，Publications
 *     是停靠展开。
 *   - **手绘元素**由 Rough.js 运行时生成（白板、便签、机柜、刻度盘、电缆），
 *     零新增下载。
 */

interface ProjectsRoomProps {
  showRoom: boolean
  isExiting: boolean
}

export function ProjectsRoom({ showRoom, isExiting }: ProjectsRoomProps) {
  const { locale } = useLocale()
  const { unlockAchievement } = useAchievementActions()
  const rootRef = useRef<THREE.Group>(null)
  /*
    教程不在这里调了 —— `RoomInterior` 从注册表读 `RoomDefinition.tutorial` 并统一调
    （ADR 20260903211338）。原先四个房间各自硬编码教程 id 与作用域字面量，
    而 `tutorial` 字段零消费者；写错成别的房间的 id 不会有任何症状。
  */

  const projects = useMemo(() => [...getProjectRoomItems(locale)], [locale])
  const [state, send] = useMachine(dockMachine)
  const phase = state.value as string

  const selectedIndex = useMemo(() => {
    if (!state.context.selectedId) return -1
    return projects.findIndex(p => p.id === state.context.selectedId)
  }, [projects, state.context.selectedId])

  // ── 进房取景 ───────────────────────────────────────────────────────────────

  /*
    进房取景交给共用 hook（`useRoomCamera`）：它从注册表取 `entryPose`，
    并且**等门开完**（`phase === 'entered'`）才接管。

    第一版在这里自己写这段 effect，触发条件是 `showRoom`——而房间在
    `CAMERA_ALIGNED` 就挂载，比 `DoorSection` 的进房飞行 tween 早约 2 秒。
    两个写者因此重叠，飞行动画被导演每帧覆盖掉（画面看起来正常，动画静默消失）。
    详见 `hooks/useRoomCamera.ts` 的说明与 ADR 20260903211244。
  */
  const handleArrive = useCallback(() => {
    unlockAchievement('projects_inspect')
  }, [unlockAchievement])

  useRoomCamera('projects', rootRef, { showRoom, isExiting }, { onArrive: handleArrive })

  // ── 停靠 ───────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((index: number) => {
    const item = projects[index]
    if (!item) return
    audioMixer.play('door_open', { volume: 0.4 })
    send({ type: 'SELECT', id: item.id })
  }, [projects, send])

  const dismiss = useCallback(() => {
    if (!hasSelection(phase)) return
    send({ type: 'DISMISS' })
  }, [phase, send])

  /**
   * 相机跟着状态机走。
   *
   * 机器只描述"现在处于哪个相位"，相机动作由相位变化触发——这个方向很重要：
   * 反过来（动画结束时才改状态）会让"动画中途被打断"变成不可表达的状态，
   * 而那正是审计 B1（传送中途退出卡死）的形态。
   */
  useEffect(() => {
    if (!showRoom || isExiting) return
    const root = rootRef.current
    if (!root) return

    if (phase === 'centering' && selectedIndex >= 0) {
      const pose = monitorDockPose(selectedIndex, projects.length)
      cameraDirector.claim(
        {
          // monitorDockPose 给的是桌心坐标，enterRoom 要门坐标
          position: toDoorFrame(pose.position),
          target: toDoorFrame(pose.target),
          duration: MONITOR_DOCK.duration,
        },
        root,
        // 停靠期间锁死：一边看细节一边能 orbit 只会让人转丢
        null,
        { onArrive: () => send({ type: 'CENTERED' }) },
      )
      return
    }

    if (phase === 'docking') {
      // 相机已到位，这一相位留给"屏幕内容展开"的动画；这里没有额外的相机动作
      const timer = window.setTimeout(() => send({ type: 'DOCKED' }), 220)
      return () => window.clearTimeout(timer)
    }

    if (phase === 'undocking') {
      cameraDirector.claim(
        projectsRoom.entryPose,
        root,
        projectsRoom.cameraFreedom,
        { onArrive: () => send({ type: 'UNDOCKED' }) },
      )
    }
  }, [phase, selectedIndex, projects.length, send, showRoom, isExiting])

  /** dismiss 的最新引用 —— ESC 消费者只注册一次，不随 phase 重建 */
  const dismissRef = useRef(dismiss)
  useEffect(() => { dismissRef.current = dismiss }, [dismiss])

  /** 退房 / 传送时取消停靠，不留悬挂状态 */
  useEffect(() => {
    if (isExiting && hasSelection(phase)) send({ type: 'CANCEL' })
  }, [isExiting, phase, send])

  /**
   * 认领 ESC —— 停靠期间 ESC 收回，而不是退出房间。
   *
   * 不能自己挂一个 window keydown：ESC 已经绑定了「退出房间」
   * （`handleDoorEscape`），两个监听同时触发时房间开始退场，收回那条路径
   * 被 `isExiting` 挡掉。实机相位序列是
   * `docked → undocking → undocking(exiting) → browsing(exiting)`
   * ——表现是「按 ESC 直接退出了房间，停靠白点」。
   *
   * `escapeStack` 定义了优先级：栈顶（最内层）先消费。
   */
  useEffect(() => {
    if (!hasSelection(phase)) return
    return pushEscapeConsumer(() => dismissRef.current())
  }, [phase])

  // ── 便签：停靠时显示当前项目的技术栈 ───────────────────────────────────────

  /*
    调试出口。相位卡住时画面上看不出区别——"点了没反应"可能是没命中、
    可能是相机没动、也可能是状态机停在一个不接受该事件的相位里。
    实机排查停靠时正是靠这个才定位到卡在 `docking`。

    只读，与 `window.__labCamera` 同一个思路。
  */
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__labProjects = {
      phase: () => phase,
      selectedIndex: () => selectedIndex,
      count: () => projects.length,
      isExiting: () => isExiting,
      showRoom: () => showRoom,
      log: () => [...phaseLog.current],
    }
  }, [phase, selectedIndex, projects.length, isExiting, showRoom])

  const phaseLog = useRef<string[]>([])
  useEffect(() => {
    phaseLog.current.push(`${phase}${isExiting ? '(exiting)' : ''}`)
    if (phaseLog.current.length > 20) phaseLog.current.shift()
  }, [phase, isExiting])

  const stickies = useMemo(() => {
    // 浏览时展示前几个项目，停靠时把当前项目排在第一格
    const ordered = selectedIndex >= 0
      ? [projects[selectedIndex]!, ...projects.filter((_, i) => i !== selectedIndex)]
      : projects
    return STICKY_SLOTS.map((slot, i) => {
      const item = ordered[i]
      if (!item) return null
      return {
        slot,
        spec: stickyForProject(item, {
          width: Math.round(slot.width * 320),
          height: Math.round(slot.height * 320),
        }),
        highlighted: selectedIndex >= 0 && i === 0,
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [projects, selectedIndex])

  return (
    <group
      ref={rootRef}
      visible={showRoom}
      /*
        点房间里的空白处（地板、墙、白板）收回停靠。

        靠**冒泡**而不是一块不可见的拦截平面：显示器自己 `stopPropagation()`，
        所以点显示器不会走到这里，点其它任何东西都会。原先那块拦截平面放在
        桌心 z=5.4，而相机在 z=1.9 朝 −Z——**它在相机背后，永远点不到**。
      */
      onClick={dismiss}
    >
      {/*
        环境光压得很低——这是「深夜」，房间靠台灯与屏幕造型。
        没有 directionalLight：一间没有窗的内屋不该有平行光。
      */}
      <ambientLight color={AMBIENT.color} intensity={AMBIENT.intensity} />

      {/*
        全部内容平移到门坐标系。

        `rootRef` 这一层是房间根（门坐标系，原点在门平面、+Z 指向门外），
        内层是桌心坐标系（scene.ts 里所有坐标所在的空间）。唯一的一处换算，
        见 scene.ts 顶部「两个坐标系」。
      */}
      <group position={[0, 0, ROOM_ORIGIN_Z]}>

        <LabShell />
        <WallDecor />
        <ServerCabinet />
        <Desk />
        <DeskLamp />

        {stickies.map(({ slot, spec, highlighted }) => {
          const { position, rotation } = wallPanelTransform(slot)
          return (
            <group key={slot.id} position={position} rotation={rotation}>
              <SketchPanel
                spec={spec}
                width={slot.width}
                height={slot.height}
                opacity={highlighted ? 1 : 0.72}
              />
            </group>
          )
        })}

        {projects.map((item, i) => (
          <ProjectMonitor
            key={item.id}
            item={item}
            index={i}
            count={projects.length}
            isSelected={i === selectedIndex}
            isDimmed={hasSelection(phase) && i !== selectedIndex}
            onSelect={handleSelect}
          />
        ))}
      </group>
    </group>
  )
}
