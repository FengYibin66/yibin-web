'use client'

import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'

/**
 * 动效倍率：`1` 正常，`0` 系统要求减少动效（ADR 20260908172231）。
 * 这是唯一读法——13 个消费者，别各自去读 store 或 `matchMedia`。
 *
 * **能乘就乘**（`* motion`）：比 `if (reduced) return` 少一类「忘了处理 reduced
 * 分支」的 bug，也保证停下来时回到基准姿态而不是停在半空。乘不掉的（呼吸的灯、
 * shader 的 `uTime`）用分支，但要冻结在一个好看的值上——亮度归零的灯看起来是坏的。
 *
 * 停由**时间**驱动的自发运动；不停由**用户动作**驱动的响应（hover 上色、
 * 点击反馈、相机距离触发的位移），关掉后者等于把交互也关了。
 *
 * 门禁 `__tests__/motionConsumers.test.ts` 守「每个时间驱动的 `useFrame` 都读过它」。
 */
export function useMotionScale(): 0 | 1 {
  return useCorridorStore(state => state.motionScale)
}
