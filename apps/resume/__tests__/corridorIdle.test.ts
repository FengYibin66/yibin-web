import { describe, expect, it } from 'vitest'

import { isCorridorIdle } from '@/lib/lab/domain/machines/room.machine'

/**
 * 「能不能打扰用户」（审计 D5）。
 *
 * `LabTutorial` 原先只检查 `isInRoom` 与 `isTeleporting`。用户点了门之后
 * 相位是 `aligning` / `loading` / `opening`——**还没进房**，所以那两个布尔量
 * 都是 false，2.4 秒的延迟一到教程就盖在开门动画上。
 *
 * 这一组钉住的是「只有 idle 才算空闲」，而不是"再补几个 phase 到黑名单里"
 * ——黑名单形态下每加一个 phase 都要记得同步，而漏掉不会报错。
 */
describe('isCorridorIdle', () => {
  it('只有 idle 算空闲', () => {
    expect(isCorridorIdle('idle')).toBe(true)
  })

  it('进房流程的每一个相位都不算空闲 —— 这些相位下弹教程会盖住动画', () => {
    for (const phase of ['aligning', 'loading', 'ready', 'opening', 'entered'] as const) {
      expect(isCorridorIdle(phase), `${phase} 被当成空闲了`).toBe(false)
    }
  })

  it('失败与退场也不算空闲', () => {
    // failed 时屏幕上是失败卡片，exiting 时在播退场动画
    expect(isCorridorIdle('failed')).toBe(false)
    expect(isCorridorIdle('exiting')).toBe(false)
  })
})
