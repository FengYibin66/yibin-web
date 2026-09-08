import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCorridorMemory,
  loadCorridorMemory,
  mergeCorridorMemory,
  saveCorridorMemory,
} from '@/lib/lab/app/memory'

/**
 * 走廊记忆的持久化边界（ADR 20260908172231）。
 *
 * 记忆是**装饰**：隐私模式、配额满、脏数据都不该阻断进入 Lab。所以这里的每
 * 一条都在问同一个问题——"坏情况下它是安静地退化，还是把 Lab 弄坏"。
 * 与 `achievementStorage` 同一取舍。
 */
describe('走廊记忆', () => {
  beforeEach(() => {
    clearCorridorMemory()
  })

  describe('读写往返', () => {
    it('写进去的读得出来', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: ['door-projects'] })
      expect(loadCorridorMemory()).toEqual({
        visited: ['door-about'],
        inked: ['door-projects'],
      })
    })

    it('空盘返回空，不抛', () => {
      expect(loadCorridorMemory()).toEqual({ visited: [], inked: [] })
    })

    it('clear 之后回到空', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: [] })
      clearCorridorMemory()
      expect(loadCorridorMemory().visited).toEqual([])
    })
  })

  describe('merge 只增不减', () => {
    it('合并保留已有项', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: [] })
      mergeCorridorMemory({ visited: ['door-projects'] })
      expect(new Set(loadCorridorMemory().visited)).toEqual(
        new Set(['door-about', 'door-projects']),
      )
    })

    it('只给一个字段时，另一个字段不受影响（这正是覆盖式写入丢数据的那条路）', () => {
      saveCorridorMemory({ visited: ['door-about'], inked: ['door-contact'] })
      mergeCorridorMemory({ inked: ['door-gallery'] })
      const after = loadCorridorMemory()
      expect(after.visited).toEqual(['door-about'])
      expect(new Set(after.inked)).toEqual(new Set(['door-contact', 'door-gallery']))
    })

    it('重复项不产生重复存储', () => {
      mergeCorridorMemory({ visited: ['door-about'] })
      mergeCorridorMemory({ visited: ['door-about'] })
      expect(loadCorridorMemory().visited).toEqual(['door-about'])
    })
  })

  describe('脏数据与未知地标', () => {
    it('未知地标 id 读时被丢弃（走廊改版后 localStorage 不会无限增长）', () => {
      saveCorridorMemory({ visited: ['door-about', 'no-such-landmark'], inked: [] })
      expect(loadCorridorMemory().visited).toEqual(['door-about'])
    })

    it('非数组字段退化为空', () => {
      localStorage.setItem(
        'resume_corridor_memory_v1',
        JSON.stringify({ visited: 'door-about', inked: 42 }),
      )
      expect(loadCorridorMemory()).toEqual({ visited: [], inked: [] })
    })

    it('不是 JSON 时返回空，不抛', () => {
      localStorage.setItem('resume_corridor_memory_v1', '{oops')
      expect(() => loadCorridorMemory()).not.toThrow()
      expect(loadCorridorMemory()).toEqual({ visited: [], inked: [] })
    })

    it('顶层是数组（旧格式 / 别人的数据）时返回空', () => {
      localStorage.setItem('resume_corridor_memory_v1', JSON.stringify(['door-about']))
      expect(loadCorridorMemory()).toEqual({ visited: [], inked: [] })
    })
  })

  describe('storage 不可用', () => {
    it('读抛异常时返回空', () => {
      const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(loadCorridorMemory()).toEqual({ visited: [], inked: [] })
      spy.mockRestore()
    })

    it('写抛异常时静默失败，不冒泡到调用方', () => {
      const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => saveCorridorMemory({ visited: ['door-about'], inked: [] })).not.toThrow()
      expect(() => mergeCorridorMemory({ visited: ['door-about'] })).not.toThrow()
      spy.mockRestore()
    })
  })
})
