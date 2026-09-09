'use client'

import { useScene } from '@/context/SceneContext'
import { ROOMS } from '@/lib/lab/domain/rooms'

/**
 * 场景的雾，按当前所在空间切换。**雾的唯一所有者**——场景级的单一属性有多个
 * 写者就会互相覆盖（同 `CameraRig` 与相机）。
 *
 * 不能挂在 Canvas 根上：走廊要距离雾（100 单位长的通道，远端不淡出就能看到
 * 接缝），而同一层雾会把房间内容也洗白（内容离相机 4–7 单位、墙面到 10）。
 * 封闭房间用 `RoomDefinition.fog = null` 表示不要雾。
 */

/** 走廊的雾 */
export const CORRIDOR_FOG = { color: '#f0ece4', near: 15, far: 60 } as const

export function SceneFog() {
  const { currentRoom } = useScene()

  // 不在房间里 = 在走廊
  const fog = currentRoom === null ? CORRIDOR_FOG : ROOMS[currentRoom].fog

  // `attach="fog"` 时返回 null 会把已挂的雾摘掉，这正是 fog: null 想要的
  if (!fog) return null

  return <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
}
