'use client'

import { useScene } from '@/context/SceneContext'
import { ROOMS } from '@/lib/lab/domain/rooms'

/**
 * 场景的雾 —— 按当前所在空间切换。
 *
 * ## 为什么不能挂在 Canvas 根上
 *
 * 走廊需要距离雾：它是一条 100 单位长的通道，远端必须淡出，否则能看到
 * 走廊尽头的接缝。`fog(#f0ece4, 15, 60)` 正是为它调的。
 *
 * 但这层雾挂在 Canvas 根上时对**所有东西**生效，包括房间里的内容。而房间
 * 的内容离相机 4–7 单位、房间墙面到 10 单位——正好从雾开始生效的距离
 * （15）之内还好，一旦房间内容排布得深一点就开始变米白。审计 A1 与 A4 都
 * 记了这一条：Projects 的塔与 About 的故事内容正好落在被洗白的距离上。
 *
 * 封闭房间根本不需要距离雾（它有墙，看不到无限远），所以 `RoomDefinition.fog`
 * 声明为 `null` 就是"不要雾"。开阔房间（About 的天空）自己声明一套。
 *
 * 这个组件是雾的唯一所有者，与 `CameraRig` 是相机的唯一所有者同一个道理：
 * 一个场景级的单一属性，有多个写者就会互相覆盖。
 */

/** 走廊的雾。原先写死在 `LabScene` 的 JSX 里 */
export const CORRIDOR_FOG = { color: '#f0ece4', near: 15, far: 60 } as const

export function SceneFog() {
  const { currentRoom } = useScene()

  // 不在房间里 = 在走廊
  const fog = currentRoom === null ? CORRIDOR_FOG : ROOMS[currentRoom].fog

  // `attach="fog"` 时返回 null 会把已挂的雾摘掉，这正是 fog: null 想要的
  if (!fog) return null

  return <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
}
