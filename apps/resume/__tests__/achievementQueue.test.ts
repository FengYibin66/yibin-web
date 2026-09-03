import { describe, expect, it } from 'vitest'

import {
  DURATIONS,
  activePopup,
  durationFor,
  initialQueueState,
  isUnlocked,
  pendingCount,
  queueReducer,
  type QueueAction,
  type QueueState,
} from '@/lib/lab/domain/achievements/queue'

/**
 * 成就气泡队列。
 *
 * 每一组对应审计里的一条：D2（同一 tick 两次 showTutorial 互相覆盖）、
 * D3（hidePopup 的定时器不校验 id，清掉后来的气泡）、D4（气泡 A 待完成时
 * B 弹出 → A 静默消失，之后完成 A 也不庆祝）。
 *
 * 三个都不是加个判断能修的——它们的共同根因是「同一时刻只能有一个气泡，
 * 而覆盖策略没定义」。所以先定义策略，再用测试把策略钉住。
 */

function run(actions: readonly QueueAction[], from: QueueState = initialQueueState): QueueState {
  return actions.reduce(queueReducer, from)
}

describe('教程气泡', () => {
  it('入队并成为队首', () => {
    const s = run([{ type: 'SHOW_TUTORIAL', id: 'corridor_enter' }])
    expect(activePopup(s)?.id).toBe('corridor_enter')
    expect(activePopup(s)?.kind).toBe('tutorial')
  })

  it('同一条重复 show 是幂等的 —— D2：首访时同一 tick 内被调了两次', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter' },
    ])
    expect(s.queue).toHaveLength(1)
  })

  it('两条不同的教程排队，后来的不顶掉先来的 —— 这正是 D2 的表现', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_explore' },
    ])
    expect(activePopup(s)?.id, '"Click a door" 被 "Scroll to explore" 顶掉了').toBe('corridor_enter')
    expect(pendingCount(s)).toBe(1)
  })

  it('已解锁的成就不再弹教程', () => {
    const s = run([
      { type: 'UNLOCK', id: 'corridor_enter' },
      { type: 'DISMISS' },
      { type: 'TICK', delta: DURATIONS.fade },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter' },
    ])
    expect(activePopup(s)).toBeNull()
  })

  it('教程气泡不会自己消失 —— 它在等用户照着做', () => {
    let s = run([{ type: 'SHOW_TUTORIAL', id: 'about_scroll' }])
    for (let i = 0; i < 50; i += 1) s = queueReducer(s, { type: 'TICK', delta: 1000 })
    expect(activePopup(s)?.id, '教程自己超时跑掉了').toBe('about_scroll')
    expect(activePopup(s)?.hiding).toBe(false)
  })
})

describe('解锁庆祝', () => {
  it('插到队首 —— D4：完成 A 时若显示的是 B，A 原先永不庆祝', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'UNLOCK', id: 'projects_inspect' },
    ])
    expect(activePopup(s)?.id).toBe('projects_inspect')
    expect(activePopup(s)?.kind).toBe('completed')
    // 被插队的教程还在，没有丢
    expect(s.queue.map(p => p.id)).toEqual(['projects_inspect', 'about_scroll'])
  })

  it('解锁自己正在展示教程的那一条 → 教程换成庆祝，不并存', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'projects_inspect' },
      { type: 'UNLOCK', id: 'projects_inspect' },
    ])
    expect(s.queue).toHaveLength(1)
    expect(activePopup(s)?.kind).toBe('completed')
  })

  it('重复解锁不产生第二个庆祝', () => {
    const s = run([
      { type: 'UNLOCK', id: 'contact_found' },
      { type: 'UNLOCK', id: 'contact_found' },
    ])
    expect(s.queue).toHaveLength(1)
    expect(s.completed).toEqual(['contact_found'])
  })

  it('到时自动淡出并出队，队首换成下一条', () => {
    let s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'UNLOCK', id: 'contact_found' },
    ])
    s = queueReducer(s, { type: 'TICK', delta: DURATIONS.completed })
    expect(activePopup(s)?.hiding, '到时没开始淡出').toBe(true)

    s = queueReducer(s, { type: 'TICK', delta: DURATIONS.fade })
    expect(activePopup(s)?.id, '淡出走完没出队').toBe('about_scroll')
  })

  it('completed 列表按解锁顺序累积', () => {
    const s = run([
      { type: 'UNLOCK', id: 'corridor_enter' },
      { type: 'UNLOCK', id: 'about_scroll' },
      { type: 'UNLOCK', id: 'contact_found' },
    ])
    expect(s.completed).toEqual(['corridor_enter', 'about_scroll', 'contact_found'])
    expect(isUnlocked(s, 'about_scroll')).toBe(true)
    expect(isUnlocked(s, 'gallery_inspect')).toBe(false)
  })
})

describe('dismiss', () => {
  it('进入淡出而不是立刻消失', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'DISMISS' },
    ])
    expect(activePopup(s)?.hiding).toBe(true)
    expect(activePopup(s)?.id).toBe('about_scroll')
  })

  it('淡出中重复 dismiss 不重置计时 —— 否则淡出永远走不完', () => {
    let s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'DISMISS' },
      { type: 'TICK', delta: 300 },
    ])
    const before = activePopup(s)!.elapsed
    s = queueReducer(s, { type: 'DISMISS' })
    expect(activePopup(s)!.elapsed).toBe(before)
  })

  it('**淡出期间新来的气泡不会被清掉** —— D3 的回归', () => {
    /*
      原实现里 `hidePopup` 起一个 500ms 的定时器把 activePopup 置 null，
      且不校验 id。于是这 500ms 内解锁的成就刚弹出就被上一个的定时器清掉。
      队列形态下"清掉"变成"出队队首"，后来的天然安全。
    */
    let s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'DISMISS' },
      { type: 'TICK', delta: 200 },
    ])
    // 淡出还没走完时解锁另一个 → 庆祝插到队首
    s = queueReducer(s, { type: 'UNLOCK', id: 'contact_found' })
    expect(activePopup(s)?.id).toBe('contact_found')

    // 把原先那个的淡出时间走完，新气泡必须还在
    s = queueReducer(s, { type: 'TICK', delta: DURATIONS.fade })
    expect(activePopup(s)?.id, '新气泡被上一个的淡出定时器清掉了').toBe('contact_found')
  })

  it('队列为空时 dismiss 是空操作', () => {
    expect(run([{ type: 'DISMISS' }])).toEqual(initialQueueState)
  })
})

describe('tick', () => {
  it('队列为空时是空操作', () => {
    expect(run([{ type: 'TICK', delta: 5000 }])).toEqual(initialQueueState)
  })

  it('只推进队首，排队中的 elapsed 不动', () => {
    let s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'SHOW_TUTORIAL', id: 'contact_found' },
    ])
    s = queueReducer(s, { type: 'TICK', delta: 1000 })
    expect(s.queue[0]!.elapsed).toBe(1000)
    expect(s.queue[1]!.elapsed, '排队中的也在计时，轮到它时已经过期了').toBe(0)
  })

  it('reducer 是纯的：不改入参', () => {
    const before = run([{ type: 'SHOW_TUTORIAL', id: 'about_scroll' }])
    const snapshot = JSON.stringify(before)
    queueReducer(before, { type: 'TICK', delta: 1000 })
    queueReducer(before, { type: 'UNLOCK', id: 'contact_found' })
    queueReducer(before, { type: 'DISMISS' })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('hydrate', () => {
  it('从存储恢复已完成列表，不产生气泡', () => {
    const s = run([{ type: 'HYDRATE', completed: ['corridor_enter', 'about_scroll'] }])
    expect(s.completed).toEqual(['corridor_enter', 'about_scroll'])
    expect(activePopup(s)).toBeNull()
  })

  it('恢复后已完成的那些不再弹教程', () => {
    const s = run([
      { type: 'HYDRATE', completed: ['about_scroll'] },
      { type: 'SHOW_TUTORIAL', id: 'about_scroll' },
      { type: 'SHOW_TUTORIAL', id: 'contact_found' },
    ])
    expect(s.queue.map(p => p.id)).toEqual(['contact_found'])
  })
})

describe('时长', () => {
  it('庆祝短、教程长 —— 一个是反馈，一个是要照着做', () => {
    expect(durationFor('completed')).toBeLessThan(durationFor('tutorial'))
  })
})
