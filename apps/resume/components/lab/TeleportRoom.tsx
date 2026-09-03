'use client'

import { memo, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useScene } from '@/context/SceneContext'
import * as THREE from 'three'
import { corridorRailJumpTo } from '@/lib/lab/app/camera/corridorRail'
import {
  doorForRoom,
  doorWorldZ,
  segmentIndexAtZ,
} from '@/lib/lab/domain/corridor/layout'

// 模块级复用，避免每次传送新建向量
const _teleportPos = new THREE.Vector3()
const _teleportTarget = new THREE.Vector3()

// 门的 Z 坐标来自 lib/lab/domain/corridor/layout —— 原先这里自带一份拷贝，
// 与 CorridorSegment / useCorridorCamera / corridorMurals 三处并列（审计 B3）。

/**
 * TeleportRoom — pure-logic R3F component (no render output).
 *
 * Listens to SceneContext for the 'teleporting' phase, instantly moves
 * the camera to 8 units in front of the target door, then calls
 * completeTeleport() so DoorSection picks up the pendingDoorClick.
 *
 * Must be rendered inside <Canvas>.
 */
const TeleportRoom = memo(function TeleportRoom() {
  const {
    teleportTarget,
    teleportPhase,
    completeTeleport,
    isFastTeleport,
    isTeleporting,
    openTeleportTransition,
  } = useScene()
  const { camera } = useThree()
  const hasPositioned = useRef(false)

  useEffect(() => {
    if (teleportPhase === 'teleporting' && teleportTarget && !hasPositioned.current) {
      /**
       * 落到**当前所在段**的那扇门，而不是永远第 0 段。
       *
       * 原先写死 `doorZ + 8`（doorZ 是段内相对坐标），于是走到第 3 段的用户
       * 传送后被拉回走廊起点，退出房间时位置也就丢了（审计 B3）。
       * 相机初始在 Z=28 时段号是 −1，钳到 0。
       */
      const currentSegment = Math.max(0, segmentIndexAtZ(camera.position.z))
      const doorZ = doorWorldZ(doorForRoom(teleportTarget).slot, currentSegment)

      {
        /*
          瞬移到门前 8 单位 —— 命令**走廊导轨**，不经相机导演
          （ADR 20260903211244）。

          第一版走 `cameraDirector.moveToWorld({ duration: 0 })`，而那在导演不
          持有相机时是**空操作**：`moveToWorld` 的零时长分支只调 `push()`，
          而 `push()` 只写 controls 的内部球面坐标——相机位姿要等 `update()`
          才应用，而走廊里导演不持有相机，`update()` 第一行就 return。

          于是相机一动不动，随后 `DoorSection` 的对齐 tween 从**旧位置**飞过去：
          非 fast 模式下用户看到的是穿过整条走廊的 1 秒飞行而不是瞬移。
          它的单测断言的是导演内部的 `snapshot()` 而不是 `camera.position`，
          所以一直是绿的。

          走廊里相机是一维导轨，本来就该由导轨的持有者移动。
        */
        const delivered = corridorRailJumpTo(doorZ + 8)
        if (!delivered && process.env.NODE_ENV !== 'production') {
          // 送不到不能静默：传送落空不报错，只表现为"传送后相机在错误的位置"
          throw new Error('走廊导轨没挂载，传送的位置命令没人接收')
        }
        camera.updateMatrixWorld()
        hasPositioned.current = true

        // Small delay to let the frame update before triggering the door click
        setTimeout(() => {
          if (isFastTeleport) {
            // Fast teleport: paper stays closed, go straight to door click
            completeTeleport()
          } else {
            // Normal teleport: open paper animation first
            openTeleportTransition()
          }
        }, 50)
      }
    }

    // Reset flag when teleportation finishes
    if (!isTeleporting) {
      hasPositioned.current = false
    }
  }, [teleportPhase, teleportTarget, isTeleporting, isFastTeleport, camera, completeTeleport, openTeleportTransition])

  return null
})

TeleportRoom.displayName = 'TeleportRoom'

export { TeleportRoom }
