import { describe, expect, it } from 'vitest'

import {
  DOG_STRIDE,
  EMPTY_STRIDE,
  PLAYER_STRIDE,
  advanceStride,
  playerFootstep,
  type StrideState,
} from '@/lib/lab/domain/corridor/footsteps'
import { SPEED_RUN, SPEED_STILL } from '@/lib/lab/domain/corridor/world'

function walk(from: number, to: number, stepsPerUnit: number, velocity: number, inCorridor = true) {
  let state: StrideState = EMPTY_STRIDE
  const steps: Array<{ variant: 'a' | 'b'; volume: number }> = []
  const n = Math.round(Math.abs(to - from) * stepsPerUnit)
  for (let i = 0; i <= n; i += 1) {
    const z = from + ((to - from) * i) / n
    const r = playerFootstep(state, z, velocity, inCorridor)
    state = r.state
    if (r.step) steps.push(r.step)
  }
  return steps
}

describe('脚步按位移触发', () => {
  it('第一帧只记位置，不响', () => {
    const r = advanceStride(EMPTY_STRIDE, 28, PLAYER_STRIDE, true)
    expect(r.step).toBeNull()
    expect(r.state.lastZ).toBe(28)
  })

  it('走 18.5 单位是 10 步（18 整会踩浮点边界），a/b 交替', () => {
    const steps = walk(28, 9.5, 20, -8)
    expect(steps).toHaveLength(10)
    expect(steps.map(s => s.variant)).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'])
  })

  it('往回走一样响（位移取绝对值）', () => {
    expect(walk(9.5, 28, 20, 8)).toHaveLength(10)
  })

  it('速度低于 still 阈值时不响，即便位置在挪（插值尾巴）', () => {
    expect(walk(28, 10, 20, SPEED_STILL / 2)).toHaveLength(0)
  })

  it('跑比走响：run 档音量更大', () => {
    const walkVol = walk(28, 20, 20, -5)[0]!.volume
    const runVol = walk(28, 20, 20, -SPEED_RUN - 1)[0]!.volume
    expect(runVol).toBeGreaterThan(walkVol)
  })

  it('不在走廊（房间里 / 传送中）不累计 —— 回到走廊不会先"补"几步', () => {
    let state: StrideState = EMPTY_STRIDE
    state = playerFootstep(state, 28, -8, true).state
    // 传送 40 单位，不在走廊
    state = playerFootstep(state, -12, -8, false).state
    // 回到走廊后第一小步不该立刻响
    const r = playerFootstep(state, -12.2, -8, true)
    expect(r.step).toBeNull()
  })

  it('狗的步距是玩家的一半', () => {
    expect(DOG_STRIDE).toBe(PLAYER_STRIDE / 2)
  })

  it('坏输入保持原状', () => {
    const r = advanceStride(EMPTY_STRIDE, Number.NaN, PLAYER_STRIDE, true)
    expect(r.state).toBe(EMPTY_STRIDE)
    expect(r.step).toBeNull()
  })
})
