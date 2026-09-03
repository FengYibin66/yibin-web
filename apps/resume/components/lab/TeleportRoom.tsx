'use client'

import { memo, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useScene } from '@/context/SceneContext'
import * as THREE from 'three'
import { cameraDirector } from '@/lib/lab/app/camera/CameraDirector'
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
          瞬移到门前 8 单位。走相机所有者的 duration=0 路径
          （ADR 20260903140617）——这里原本是直接 `camera.position.set` +
          `camera.rotation.set`，是四处违例之一。

          走廊坐标就是世界坐标（走廊内容不挂在旋转过的 group 下），所以
          直接用 moveToWorld 而不是 enterRoom：没有房间局部坐标要换算。
        */
        cameraDirector.moveToWorld(
          _teleportPos.set(0, 0.2, doorZ + 8),
          // 看向门（−Z 方向），等价于原先把 rotation 归零
          _teleportTarget.set(0, 0.2, doorZ),
          { duration: 0 },
        )
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
