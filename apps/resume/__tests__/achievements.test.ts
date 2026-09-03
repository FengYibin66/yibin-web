import { describe, expect, it } from 'vitest'

import { content } from '@/lib/content'
import {
  ACHIEVEMENT_IDS,
  COLLECTABLE_ACHIEVEMENT_IDS,
  HINT_ONLY_ACHIEVEMENTS,
  isAchievementId,
} from '@/lib/lab/domain/ids'

/**
 * 成就的**注册表与文案**。行为（气泡队列）在
 * `__tests__/achievementQueue.test.ts`，那才是逻辑所在。
 *
 * ## 这个文件重写过，原因值得记下来
 *
 * 原版有 121 行，其中约 90 行是把 `AchievementsContext` 的气泡逻辑
 * **重抄一遍**（`showTutorialLogic` / `unlockAchievementLogic` 之类的"纯函数
 * 提取"），然后测那份拷贝。测拷贝的问题不只是不测真代码——它还会把 bug
 * 一起抄进来并锁死：原版最后一条用例叫
 *
 *   「about_scroll overwrites corridor_enter because last request wins」
 *
 * 那正是审计 D2（"Click a door" 只显示一帧就被顶掉）的**行为本身**，
 * 被当成期望写进了断言。所以那个 bug 从来不会被测试发现——测试在保护它。
 *
 * 现在逻辑在 `domain/achievements/queue.ts`（真代码，无拷贝），这里只断言
 * 两件"注册表级"的事实。
 */

describe('成就 id 注册表', () => {
  it('七个 id 齐全', () => {
    expect([...ACHIEVEMENT_IDS].sort()).toEqual([
      'about_scroll',
      'contact_found',
      'corridor_enter',
      'corridor_explore',
      'gallery_inspect',
      'projects_inspect',
      'publications_read',
    ])
  })

  it('id 无重复', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length)
  })

  it('isAchievementId 认得注册表里的，不认别的', () => {
    for (const id of ACHIEVEMENT_IDS) expect(isAchievementId(id)).toBe(true)
    for (const bogus of ['', 'nope', 'corridor', null, undefined, 42]) {
      expect(isAchievementId(bogus)).toBe(false)
    }
  })
})

describe('成就文案（唯一来源是 content[locale].labUi.tutorials）', () => {
  it('两种语言都为每个 id 提供了标题与说明', () => {
    for (const locale of ['en', 'zh'] as const) {
      const tutorials = content[locale].labUi.tutorials
      for (const id of ACHIEVEMENT_IDS) {
        const def = tutorials[id]
        expect(def, `${locale} 缺 ${id}`).toBeDefined()
        expect(def.title.trim().length, `${locale}/${id} 标题为空`).toBeGreaterThan(0)
        expect(def.label.trim().length, `${locale}/${id} 说明为空`).toBeGreaterThan(0)
      }
    }
  })

  it('文案表里没有注册表之外的 id —— 多出来的永远不会显示', () => {
    for (const locale of ['en', 'zh'] as const) {
      const extra = Object.keys(content[locale].labUi.tutorials)
        .filter(id => !isAchievementId(id))
      expect(extra, `${locale} 多了：${extra.join(', ')}`).toEqual([])
    }
  })

  it('中文文案确实是中文 —— 漏译会静默留下英文', () => {
    const tutorials = content.zh.labUi.tutorials
    for (const id of ACHIEVEMENT_IDS) {
      const { title, label } = tutorials[id]
      expect(
        /[一-鿿]/.test(title + label),
        `zh/${id} 里没有一个汉字，像是漏译：「${title}」「${label}」`,
      ).toBe(true)
    }
  })

  it('gallery_inspect 的文案指向"打开照片"，不是旧版的"点击项目"（审计 D1）', () => {
    // /gallery 现在是摄影相册，不是项目列表
    expect(content.en.labUi.tutorials.gallery_inspect.label.toLowerCase()).toContain('photo')
    expect(content.zh.labUi.tutorials.gallery_inspect.label).toContain('照片')
    for (const locale of ['en', 'zh'] as const) {
      expect(content[locale].labUi.tutorials.gallery_inspect.label.toLowerCase())
        .not.toContain('project')
    }
  })
})

describe('可收集的成就 vs 入门提示', () => {
  it('入门提示不算可收集', () => {
    for (const id of HINT_ONLY_ACHIEVEMENTS) {
      expect(COLLECTABLE_ACHIEVEMENT_IDS, `${id} 仍算在可收集里`).not.toContain(id)
    }
  })

  it('两者合起来正是全部 id —— 少一个的话那个成就哪儿都不出现', () => {
    expect([...COLLECTABLE_ACHIEVEMENT_IDS, ...HINT_ONLY_ACHIEVEMENTS].sort())
      .toEqual([...ACHIEVEMENT_IDS].sort())
  })

  it('入门提示确实不持久化 —— 「每次访问都该出现」的前提', async () => {
    const { saveAchievements, loadAchievements } = await import('@/lib/lab/achievementStorage')
    saveAchievements([...ACHIEVEMENT_IDS])
    const loaded = loadAchievements()
    for (const id of HINT_ONLY_ACHIEVEMENTS) {
      expect(loaded, `${id} 被持久化了，下次访问就不会再提示`).not.toContain(id)
    }
    for (const id of COLLECTABLE_ACHIEVEMENT_IDS) {
      expect(loaded, `${id} 没被持久化`).toContain(id)
    }
  })

  it('「已探索 N / M」的 M 与列出的条数一致 —— 原先列 7 行却写 6', () => {
    for (const locale of ['en', 'zh'] as const) {
      const template = content[locale].labUi.panels.exploredCount
      expect(template, `${locale} 的模板缺 {total} 占位符`).toContain('{total}')
      expect(template, `${locale} 的模板缺 {done} 占位符`).toContain('{done}')
    }
    // 面板用 COLLECTABLE_ACHIEVEMENT_IDS 同时驱动"列出"与"总数"，
    // 所以两者不可能再对不上；这里断言那个来源非空
    expect(COLLECTABLE_ACHIEVEMENT_IDS.length).toBeGreaterThan(0)
  })
})
