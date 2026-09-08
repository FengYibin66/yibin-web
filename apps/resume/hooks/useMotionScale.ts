'use client'

import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'

/**
 * 动效倍率：`1` 正常，`0` 系统要求减少动效（ADR 20260908172231）。
 *
 * ## 为什么值得一个 hook 而不是各自读 store
 *
 * 这个量有 13 个消费者（走廊 4 个 + 房间 9 个），而"从哪读"是它唯一容易走偏的
 * 地方：有人订阅 store、有人调 `matchMedia`、有人干脆自己存一份，于是同一时刻
 * 出现两个答案。判定原则（ADR 20260908172231）是**同一个量只有一个来源**，
 * 那就该只有一个读法。
 *
 * ## 用法
 *
 * ```tsx
 * const motion = useMotionScale()
 * useFrame(({ clock }) => {
 *   // 乘上去：reduced 时幅度归零，正常时不受影响
 *   mesh.position.y = base + Math.sin(clock.elapsedTime) * 0.1 * motion
 * })
 * ```
 *
 * **乘而不是分支**：`* motion` 比 `if (reduced) return` 少一类"忘了处理 reduced
 * 分支"的 bug，也天然保证停下来时回到**基准姿态**而不是停在半空中（停在半空
 * 歪着的东西看起来像加载失败）。
 *
 * 幅度乘不掉的情况（呼吸的灯、shader 的 uTime、按时间推进的漂移）用分支，
 * 但要**冻结在一个好看的值**上而不是 0 —— 亮度归零的灯看起来是坏的。
 *
 * ## 停什么、不停什么
 *
 * 停：由**时间**驱动的自发运动（漂浮、呼吸、逐帧、漂移）。
 * 不停：由**用户动作**驱动的响应（hover 上色、点击反馈、相机靠近触发的位移）。
 * 关掉后者等于把交互也关掉了。
 *
 * 门禁 `__tests__/motionConsumers.test.ts` 守「每个时间驱动的 `useFrame` 都读过
 * 这个量」。
 */
export function useMotionScale(): 0 | 1 {
  return useCorridorStore(state => state.motionScale)
}
