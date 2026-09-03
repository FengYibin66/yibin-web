import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadAchievements,
  recordAchievement,
  saveAchievements,
} from '@/lib/lab/achievementStorage'
import { ACHIEVEMENTS } from '@/context/AchievementsContext'

/**
 * 成就持久化的回归测试。
 *
 * 核心断言是「**不需要 React Provider 就能记成就**」——审计 D1 的根因正是
 * `/gallery` 独立路由在 `AchievementsProvider` 之外，于是 `gallery_inspect`
 * 的唯一解锁路径落在一个零渲染方的组件里，成就永远 locked。
 */

const KEY = 'resume_achievements'

describe('achievementStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('在没有任何 React Provider 的情况下也能读写（审计 D1 的核心）', () => {
    expect(recordAchievement('gallery_inspect')).toBe(true)
    expect(loadAchievements()).toContain('gallery_inspect')
  })

  it('重复记录返回 false 且不产生重复项', () => {
    expect(recordAchievement('contact_found')).toBe(true)
    expect(recordAchievement('contact_found')).toBe(false)
    expect(loadAchievements().filter((id) => id === 'contact_found')).toHaveLength(1)
  })

  it('corridor_enter 读写两侧都被过滤 —— 入门提示每次访问都该出现', () => {
    expect(recordAchievement('corridor_enter')).toBe(false)
    saveAchievements(['corridor_enter', 'about_scroll'])
    expect(loadAchievements()).toEqual(['about_scroll'])
  })

  it('脏数据不抛异常', () => {
    for (const junk of ['not json', '{"a":1}', '"a string"', 'null', '[1,2,{}]']) {
      localStorage.setItem(KEY, junk)
      expect(() => loadAchievements()).not.toThrow()
    }
    // [1,2,{}] 里没有字符串项 → 过滤后为空
    localStorage.setItem(KEY, '[1,2,{}]')
    expect(loadAchievements()).toEqual([])
  })

  it('localStorage 抛异常时静默降级，不阻断流程', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadAchievements()).toEqual([])
    spy.mockRestore()

    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => saveAchievements(['x'])).not.toThrow()
    setSpy.mockRestore()
  })

  it('每个成就 id 都在注册表里有定义 —— 防止写入注册表里不存在的 id', () => {
    const known = new Set(Object.keys(ACHIEVEMENTS))
    for (const id of ['gallery_inspect', 'contact_found', 'about_scroll', 'corridor_enter']) {
      expect(known, `${id} 不在 ACHIEVEMENTS 里`).toContain(id)
    }
  })

  it('gallery_inspect 的文案指向"在画廊打开照片"，不是旧版的"点击项目"', () => {
    // /gallery 现在是摄影相册，不是项目列表；旧文案是上一版设计的残留
    expect(ACHIEVEMENTS.gallery_inspect!.label.toLowerCase()).toMatch(/photo|gallery/)
    expect(ACHIEVEMENTS.gallery_inspect!.label.toLowerCase()).not.toContain('project')
  })
})
