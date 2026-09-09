'use client'

import { useEffect } from 'react'
import type * as THREE from 'three'

import type { RoomId } from '@/context/SceneContext'
import { useScene } from '@/context/SceneContext'
import { cameraDirector } from '@/lib/lab/app/camera/CameraDirector'
import { ROOMS } from '@/lib/lab/domain/rooms'

/**
 * 房间接管相机：从注册表取 `entryPose` / `cameraFreedom`，在**开门结束之后**
 * 接管，退房时交还（ADR 20260903211244）。
 *
 * **必须等 `phase === 'entered'`**：房间在 `CAMERA_ALIGNED` 就挂载，而
 * `DoorSection` 的进房飞行 tween 要到 `OPEN_DOOR` 之后才开始。挂载时就接管会让
 * 两个写者重叠约 2 秒，谁赢取决于 gsap 的 rAF 与 R3F 渲染循环谁后注册
 * ——今天恰好是导演每帧覆盖，**飞行动画被静默吞掉而画面看起来正常**。
 *
 * ## 为什么从注册表取而不是各房间自己传
 *
 * `RoomDefinition.entryPose` / `cameraFreedom` 声明了每间房的取景，但在此之前
 * **只有 Projects 消费它们**——所以 ADR 20260903140615 说的「审计 A1/A3
 * （About / Contact 无房间级相机）由 entryPose 修复」在运行时并不成立：那两间房
 * 的 `entryPose` 是死声明，进门后相机停在 30 单位外、内容挤在 200px 宽里。
 *
 * 从这里统一取之后，加一个房间只需要在它的 `RoomDefinition` 里写 `entryPose`。
 *
 * ## 谁不该用这个 hook
 *
 * Publications 有自己的一套 gsap 相机（卡片浏览 / 打开单篇），ADR 决定**保留**
 * 它——所以它不调这个 hook，而是显式 `release()`。所有权在它那里是"显式让位"
 * 而非"统一持有"。
 *
 * @param roomId 用于从 `ROOMS` 取声明
 * @param rootRef 房间根 group。`entryPose` 是**房间局部坐标**，换算需要它的
 *   `matrixWorld`——而那只有挂进场景图之后才有意义（提前算会拿到单位矩阵，
 *   那就退回成"按世界坐标处理"，也就是审计 A4）
 */
export function useRoomCamera(
  roomId: RoomId,
  rootRef: React.RefObject<THREE.Group | null>,
  { showRoom, isExiting }: { showRoom: boolean, isExiting: boolean },
  opts: { onArrive?: () => void } = {},
): void {
  const { roomLoadState: { phase } } = useScene()
  const { onArrive } = opts

  useEffect(() => {
    if (!showRoom || isExiting) return
    // 等门开完：在这之前 DoorSection 还在写相机（见上方说明）
    if (phase !== 'entered') return

    const root = rootRef.current
    if (!root) return

    // `entryPose` 与 `cameraFreedom` 是 RoomDefinition 的必填字段，不需要判空
    const room = ROOMS[roomId]
    cameraDirector.claim(room.entryPose, root, room.cameraFreedom, { onArrive })

    return () => {
      // 退房前把相机交还给 DoorSection 的退场编排
      cameraDirector.release()
    }
  }, [roomId, rootRef, showRoom, isExiting, phase, onArrive])
}
