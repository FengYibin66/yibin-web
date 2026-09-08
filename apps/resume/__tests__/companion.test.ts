import { describe, expect, it } from 'vitest'

import {
  CAT_SLEEP_DISTANCE,
  CAT_WAKE_DISTANCE,
  nextCatState,
  type CatState,
} from '@/lib/lab/domain/corridor/companion'

/**
 * 走廊活物的行为规则（ADR 20260908160918）。
 *
 * 这批测试替代了一条在 CI 上必然超时的 E2E：判据原先写在 `ResidentCat` 的
 * `useFrame` 里，于是"靠近会醒吗"只能靠 E2E 走 80 个世界单位去验，而 Lab 的
 * E2E 跑在 SwiftShader 软渲染上，导轨的指数插值在那个帧率下收敛极慢。
 * 纯逻辑就该在纯函数里测。
 */
describe('猫的三态', () => {
  describe('滞回', () => {
    it('睡着时，进入 8 单位内才醒', () => {
      expect(nextCatState('sleep', CAT_WAKE_DISTANCE + 0.1)).toBe('sleep')
      expect(nextCatState('sleep', CAT_WAKE_DISTANCE)).toBe('awake')
      expect(nextCatState('sleep', 0)).toBe('awake')
    })

    it('醒着时，要离开 12 单位才睡（不是 8）', () => {
      expect(nextCatState('awake', CAT_WAKE_DISTANCE + 1)).toBe('awake')
      expect(nextCatState('awake', CAT_SLEEP_DISTANCE)).toBe('awake')
      expect(nextCatState('awake', CAT_SLEEP_DISTANCE + 0.1)).toBe('sleep')
    })

    /**
     * 滞回存在的理由：两个阈值之间是"保持原状"的区间。
     * 单阈值会让站在临界点上的人看到猫反复睁眼闭眼。
     */
    it('两个阈值之间保持原状态（这就是滞回）', () => {
      const between = (CAT_WAKE_DISTANCE + CAT_SLEEP_DISTANCE) / 2
      expect(nextCatState('sleep', between)).toBe('sleep')
      expect(nextCatState('awake', between)).toBe('awake')
    })

    it('阈值之间不会自发切换（反复调用仍是原状态）', () => {
      const between = 10
      let state: CatState = 'sleep'
      for (let i = 0; i < 100; i += 1) state = nextCatState(state, between)
      expect(state).toBe('sleep')

      state = 'awake'
      for (let i = 0; i < 100; i += 1) state = nextCatState(state, between)
      expect(state).toBe('awake')
    })
  })

  describe('伸懒腰不受距离影响', () => {
    it('stretch 状态下，任何距离都保持 stretch（由动画结束切回）', () => {
      for (const d of [0, 8, 12, 100]) {
        expect(nextCatState('stretch', d)).toBe('stretch')
      }
    })
  })

  describe('坏输入', () => {
    it('非有限距离保持原状态（导轨还没初始化时不该乱切）', () => {
      expect(nextCatState('sleep', Number.NaN)).toBe('sleep')
      expect(nextCatState('awake', Number.NaN)).toBe('awake')
      expect(nextCatState('sleep', Number.POSITIVE_INFINITY)).toBe('sleep')
    })

    it('负距离按绝对值算（相机在猫的另一侧）', () => {
      expect(nextCatState('sleep', -4)).toBe('awake')
      expect(nextCatState('awake', -20)).toBe('sleep')
    })
  })

  describe('一趟走过去再走远的完整序列', () => {
    it('远 → 近 → 远，状态按预期翻转两次', () => {
      const distances = [30, 20, 13, 9, 7, 3, 0, 5, 9, 11, 13, 25]
      const seen: CatState[] = []
      let state: CatState = 'sleep'
      for (const d of distances) {
        state = nextCatState(state, d)
        seen.push(state)
      }
      /*
        距离    30    20    13    9     7     3     0     5     9     11    13    25
        状态    睡    睡    睡    睡    醒    醒    醒    醒    醒    醒    睡    睡
                                  ↑ 9 > 8，还没到醒的阈值   ↑ 13 > 12，才睡回去

        d = 9 那一步是这条断言的重点：它落在两个阈值之间，所以**保持睡着**。
        写这条测试时我自己先把它算成了"醒"——滞回的边界就是这么容易错。
      */
      expect(seen).toEqual([
        'sleep', 'sleep', 'sleep', 'sleep',
        'awake', 'awake', 'awake', 'awake', 'awake', 'awake',
        'sleep', 'sleep',
      ])
    })
  })
})
