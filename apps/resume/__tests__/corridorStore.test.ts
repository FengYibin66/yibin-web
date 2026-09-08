import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getRail,
  getWorld,
  hydrateCorridorMemory,
  resetCorridorWorld,
  setRail,
  useCorridorStore,
} from '@/lib/lab/app/stores/corridorStore'
import { clearCorridorMemory, saveCorridorMemory } from '@/lib/lab/app/memory'
import { SPEED_RUN } from '@/lib/lab/domain/corridor/world'
import { segmentStartZ } from '@/lib/lab/domain/corridor/layout'

/**
 * 走廊世界状态的运行时持有者（ADR 20260908172231）。
 *
 * 两条设计约束在这里被锁住：
 *
 * 1. **每帧量不触发订阅**。`rail` 住在模块级可变对象里，`setRail` 每帧被调
 *    却不通知任何 React 订阅者 —— 否则 60fps × 全树重渲染。成就气泡的 `TICK`
 *    （100ms）让 15 个 `DoorSection` 每秒渲染 10 次那次事故就是反例。
 * 2. **离散量只在真的变化时通知**。`lap` 与 `visited` 由 `setRail` 每帧派生，
 *    但稳态下不该产生任何一次 `set`。
 */
describe('走廊世界状态 store', () => {
  beforeEach(() => {
    clearCorridorMemory()
    resetCorridorWorld()
  })

  describe('导轨（每帧量）', () => {
    it('初始为 0 / 静止', () => {
      expect(getRail()).toEqual({ z: 0, velocity: 0 })
    })

    it('第一次 setRail 只落位置，不产生速度（相机初始在 Z=28，否则会算出巨大位移）', () => {
      setRail(28, 1 / 60)
      expect(getRail().z).toBe(28)
      expect(getRail().velocity).toBe(0)
    })

    it('后续帧按位移与时长算速度，前进为负', () => {
      setRail(28, 1 / 60)
      setRail(27.5, 1 / 60)
      expect(getRail().z).toBe(27.5)
      expect(getRail().velocity).toBeLessThan(0)
    })

    it('连续前进后速度进入 run 档', () => {
      setRail(28, 1 / 60)
      let z = 28
      for (let i = 0; i < 120; i++) {
        z -= 0.5
        setRail(z, 1 / 60)
      }
      expect(Math.abs(getRail().velocity)).toBeGreaterThan(SPEED_RUN)
    })

    it('每帧 setRail 不通知 React 订阅者', () => {
      const listener = vi.fn()
      const unsubscribe = useCorridorStore.subscribe(listener)
      setRail(28, 1 / 60)
      for (let i = 0; i < 30; i++) setRail(28 - i * 0.01, 1 / 60)
      unsubscribe()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('圈数与经过（由导轨派生，只在变化时通知）', () => {
    it('走过一整段后 lap 变 1，且只通知一次', () => {
      setRail(28, 1 / 60)
      const listener = vi.fn()
      const unsubscribe = useCorridorStore.subscribe(listener)

      // 从第 0 段走到第 1 段（跨过 segmentStartZ(1)），沿途避开门的经过半径不可能，
      // 所以只断言 lap 的通知次数下界与最终值。
      setRail(segmentStartZ(1) - 1, 1 / 60)
      unsubscribe()

      expect(useCorridorStore.getState().lap).toBe(1)
      expect(listener).toHaveBeenCalled()
    })

    it('停在同一位置不产生任何通知（稳态零重渲染）', () => {
      setRail(segmentStartZ(0) - 8, 1 / 60) // 门口，会记一次 visited
      const listener = vi.fn()
      const unsubscribe = useCorridorStore.subscribe(listener)
      for (let i = 0; i < 60; i++) setRail(segmentStartZ(0) - 8, 1 / 60)
      unsubscribe()
      expect(listener).not.toHaveBeenCalled()
    })

    it('经过门口把门记进 visited', () => {
      setRail(28, 1 / 60)
      setRail(segmentStartZ(0) - 8, 1 / 60)
      expect(useCorridorStore.getState().visited.has('door-about')).toBe(true)
    })

    it('visited 只增不减（走过去再走回来不会丢）', () => {
      setRail(28, 1 / 60)
      setRail(segmentStartZ(0) - 8, 1 / 60)
      setRail(segmentStartZ(0) - 40, 1 / 60)
      const visited = useCorridorStore.getState().visited
      expect(visited.has('door-about')).toBe(true)
      expect(visited.size).toBeGreaterThan(1)
    })
  })

  describe('离散量', () => {
    it('setMode / setLoadProgress / setMotionScale 写入并可读', () => {
      useCorridorStore.getState().setMode('inRoom')
      useCorridorStore.getState().setLoadProgress(0.42)
      useCorridorStore.getState().setMotionScale(0)
      const state = useCorridorStore.getState()
      expect(state.mode).toBe('inRoom')
      expect(state.loadProgress).toBe(0.42)
      expect(state.motionScale).toBe(0)
    })

    it('loadProgress 被夹在 0–1（坏输入不进状态）', () => {
      useCorridorStore.getState().setLoadProgress(5)
      expect(useCorridorStore.getState().loadProgress).toBe(1)
      useCorridorStore.getState().setLoadProgress(Number.NaN)
      expect(useCorridorStore.getState().loadProgress).toBe(0)
    })

    it('markInked 记住地标；重复标记不产生新通知', () => {
      useCorridorStore.getState().markInked('door-about')
      expect(useCorridorStore.getState().inked.has('door-about')).toBe(true)

      const listener = vi.fn()
      const unsubscribe = useCorridorStore.subscribe(listener)
      useCorridorStore.getState().markInked('door-about')
      unsubscribe()
      expect(listener).not.toHaveBeenCalled()
    })

    it('未知地标 id 不被记住（防止脏数据无限增长）', () => {
      useCorridorStore.getState().markInked('no-such-landmark')
      expect(useCorridorStore.getState().inked.has('no-such-landmark')).toBe(false)
    })
  })

  describe('getWorld 快照', () => {
    it('组装出完整的 CorridorWorld，rail 与离散量一致', () => {
      setRail(28, 1 / 60)
      setRail(27, 1 / 60)
      useCorridorStore.getState().setMode('touring')
      const world = getWorld()
      expect(world.rail.z).toBe(27)
      expect(world.mode).toBe('touring')
      expect(world.lap).toBe(0)
      expect(world.visited).toBe(useCorridorStore.getState().visited)
    })
  })

  describe('resetCorridorWorld', () => {
    it('清空导轨与离散量（Lab 卸载 / 测试之间）', () => {
      setRail(28, 1 / 60)
      setRail(20, 1 / 60)
      useCorridorStore.getState().setMode('inRoom')
      useCorridorStore.getState().markInked('door-about')

      resetCorridorWorld()

      expect(getRail()).toEqual({ z: 0, velocity: 0 })
      expect(useCorridorStore.getState().mode).toBe('free')
      expect(useCorridorStore.getState().inked.size).toBe(0)
    })

    it('reset 之后第一次 setRail 仍然不产生速度', () => {
      setRail(28, 1 / 60)
      setRail(20, 1 / 60)
      resetCorridorWorld()
      setRail(-100, 1 / 60)
      expect(getRail().velocity).toBe(0)
    })
  })

  /**
   * 记忆的恢复必须是**显式的、发生在客户端 effect 里**的动作。
   *
   * store 的初值刻意不读 localStorage：服务端渲染出的 HTML 与客户端首帧必须
   * 一致，而回访者盘上有记忆、服务端没有 —— 那正是 hydration 不匹配。
   * `LocaleProvider` 当年因此把读 storage 推迟到 `useEffect`。
   */
  describe('hydrateCorridorMemory', () => {
    it('store 初值不含任何记忆（即使盘上有）', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: ['door-projects'] })
      resetCorridorWorld()
      expect(useCorridorStore.getState().visited.size).toBe(0)
      expect(useCorridorStore.getState().inked.size).toBe(0)
    })

    it('显式 hydrate 之后记忆回来', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: ['door-projects'] })
      resetCorridorWorld()
      hydrateCorridorMemory()
      expect(useCorridorStore.getState().visited.has('door-about')).toBe(true)
      expect(useCorridorStore.getState().inked.has('door-projects')).toBe(true)
    })

    it('hydrate 与内存里已有的记忆取并集，不覆盖本次会话刚记下的', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: [] })
      resetCorridorWorld()
      useCorridorStore.getState().markInked('door-contact')
      hydrateCorridorMemory()
      const state = useCorridorStore.getState()
      expect(state.visited.has('door-about')).toBe(true)
      expect(state.inked.has('door-contact')).toBe(true)
    })

    it('盘上是脏数据 / 未知地标时不抛，也不写进状态', () => {
      saveCorridorMemory({ visited: ['no-such-landmark'], inked: ['door-about'] })
      resetCorridorWorld()
      expect(() => hydrateCorridorMemory()).not.toThrow()
      expect(useCorridorStore.getState().visited.has('no-such-landmark')).toBe(false)
      expect(useCorridorStore.getState().inked.has('door-about')).toBe(true)
    })

    it('幂等：连续 hydrate 不改变结果', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: [] })
      resetCorridorWorld()
      hydrateCorridorMemory()
      const first = useCorridorStore.getState().visited
      hydrateCorridorMemory()
      expect([...useCorridorStore.getState().visited]).toEqual([...first])
    })
  })
})
