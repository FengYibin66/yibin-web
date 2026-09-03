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

/*
  下面这些用例测的是**队列策略**（插队、幂等、淡出、出队顺序），与作用域无关，
  所以统一用 `'corridor'`。作用域本身的行为另有一组（见文件末尾）。
*/

describe('教程气泡', () => {
  it('入队并成为队首', () => {
    const s = run([{ type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' }])
    expect(activePopup(s)?.id).toBe('corridor_enter')
    expect(activePopup(s)?.kind).toBe('tutorial')
  })

  it('同一条重复 show 是幂等的 —— D2：首访时同一 tick 内被调了两次', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' },
    ])
    expect(s.queue).toHaveLength(1)
  })

  it('两条不同的教程排队，后来的不顶掉先来的 —— 这正是 D2 的表现', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_explore', scope: 'corridor' },
    ])
    expect(activePopup(s)?.id, '"Click a door" 被 "Scroll to explore" 顶掉了').toBe('corridor_enter')
    expect(pendingCount(s)).toBe(1)
  })

  it('已解锁的成就不再弹教程', () => {
    const s = run([
      { type: 'UNLOCK', id: 'corridor_enter' },
      { type: 'DISMISS' },
      { type: 'TICK', delta: DURATIONS.fade },
      { type: 'SHOW_TUTORIAL', id: 'corridor_enter', scope: 'corridor' },
    ])
    expect(activePopup(s)).toBeNull()
  })

  it('教程气泡不会自己消失 —— 它在等用户照着做', () => {
    let s = run([{ type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' }])
    for (let i = 0; i < 50; i += 1) s = queueReducer(s, { type: 'TICK', delta: 1000 })
    expect(activePopup(s)?.id, '教程自己超时跑掉了').toBe('about_scroll')
    expect(activePopup(s)?.hiding).toBe(false)
  })
})

describe('解锁庆祝', () => {
  it('插到队首 —— D4：完成 A 时若显示的是 B，A 原先永不庆祝', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
      { type: 'UNLOCK', id: 'projects_inspect' },
    ])
    expect(activePopup(s)?.id).toBe('projects_inspect')
    expect(activePopup(s)?.kind).toBe('completed')
    // 被插队的教程还在，没有丢
    expect(s.queue.map(p => p.id)).toEqual(['projects_inspect', 'about_scroll'])
  })

  it('解锁自己正在展示教程的那一条 → 教程换成庆祝，不并存', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'projects_inspect', scope: 'corridor' },
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
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
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
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
      { type: 'DISMISS' },
    ])
    expect(activePopup(s)?.hiding).toBe(true)
    expect(activePopup(s)?.id).toBe('about_scroll')
  })

  it('淡出中重复 dismiss 不重置计时 —— 否则淡出永远走不完', () => {
    let s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
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
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
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
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'contact_found', scope: 'corridor' },
    ])
    s = queueReducer(s, { type: 'TICK', delta: 1000 })
    expect(s.queue[0]!.elapsed).toBe(1000)
    expect(s.queue[1]!.elapsed, '排队中的也在计时，轮到它时已经过期了').toBe(0)
  })

  it('reducer 是纯的：不改入参', () => {
    const before = run([{ type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' }])
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
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'contact_found', scope: 'corridor' },
    ])
    expect(s.queue.map(p => p.id)).toEqual(['contact_found'])
  })
})

describe('时长', () => {
  it('庆祝短、教程长 —— 一个是反馈，一个是要照着做', () => {
    expect(durationFor('completed')).toBeLessThan(durationFor('tutorial'))
  })
})

// ─── 作用域（ADR 20260903211302）────────────────────────────────────────────

describe('气泡的作用域', () => {
  /*
    教程气泡刻意不自动消失（它在等用户照着做），所以"什么时候消失"必须有人负责。
    原先负责人是调用侧——四个互不知情的房间组件加一个走廊，结果只有一间房做了。

    表现：进 About 不滚动 → 2 秒后弹出教程 → 退回走廊 → 气泡一直挂着；再进别的
    房间，它的教程排在队列第二位，**永远显示不出来**。漏掉一处不是"多一个气泡"，
    而是教程系统整体失效，且没有任何症状指向队列。

    改成气泡自己声明作用域之后，清理只发生在一处（场景切换），加房间不需要记住
    任何事。
  */

  it('离开作用域时属于它的气泡整批出队', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      { type: 'SHOW_TUTORIAL', id: 'corridor_explore', scope: 'corridor' },
      { type: 'DISMISS_SCOPE', scope: 'room:about' },
    ])
    expect(s.queue.map(p => p.id)).toEqual(['corridor_explore'])
  })

  it('进入新场景时只留下 global 与当前场景的气泡', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'corridor_explore', scope: 'corridor' },
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      { type: 'ENTER_SCOPE', scope: 'room:about' },
    ])
    expect(s.queue.map(p => p.id)).toEqual(['about_scroll'])
  })

  it('庆祝气泡是 global，不受场景切换影响 —— 它是对刚才动作的反馈', () => {
    const s = run([
      { type: 'UNLOCK', id: 'projects_inspect' },
      { type: 'ENTER_SCOPE', scope: 'corridor' },
    ])
    expect(activePopup(s)?.id).toBe('projects_inspect')
    expect(activePopup(s)?.kind).toBe('completed')
  })

  it('按 id 出队：队首走淡出，排队中的直接消失', () => {
    const withTwo = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      { type: 'SHOW_TUTORIAL', id: 'contact_found', scope: 'room:contact' },
    ])

    // 队首：进淡出而不是立刻消失（否则画面上是"闪没"）
    const headGone = queueReducer(withTwo, { type: 'DISMISS_ID', id: 'about_scroll' })
    expect(headGone.queue[0]?.id).toBe('about_scroll')
    expect(headGone.queue[0]?.hiding).toBe(true)

    // 非队首：还没显示过，没有可淡出的东西，直接出队
    const tailGone = queueReducer(withTwo, { type: 'DISMISS_ID', id: 'contact_found' })
    expect(tailGone.queue.map(p => p.id)).toEqual(['about_scroll'])
  })

  it('出队不存在的 id 是空操作（返回同一个 state）', () => {
    const before = run([{ type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' }])
    expect(queueReducer(before, { type: 'DISMISS_ID', id: 'contact_found' })).toBe(before)
  })

  it('作用域清空之后再进同一间房，教程能重新弹 —— 不然只能看一次', () => {
    const cleared = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      { type: 'ENTER_SCOPE', scope: 'corridor' },
    ])
    expect(cleared.queue).toHaveLength(0)

    const again = queueReducer(cleared, {
      type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about',
    })
    expect(activePopup(again)?.id).toBe('about_scroll')
  })
})

describe('插队时丢掉正在淡出的队首（幽灵气泡）', () => {
  it('淡出中的队首被插队时直接丢弃，不会在庆祝之后又冒出来', () => {
    /*
      不丢的话它会被挤到第二位、`hiding: true` 与 `elapsed` 原样保留，于是庆祝
      播完之后它以淡出状态**重新出现**，播完剩下的那不到 500ms——一个已经在消失
      的气泡又闪一下。review 把这条叫"幽灵气泡"。
    */
    const fading = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      { type: 'DISMISS' },
    ])
    expect(fading.queue[0]?.hiding).toBe(true)

    const unlocked = queueReducer(fading, { type: 'UNLOCK', id: 'contact_found' })
    expect(unlocked.queue.map(p => p.id)).toEqual(['contact_found'])
  })

  it('没在淡出的队首会被保留到庆祝之后 —— 那条教程还没看完', () => {
    const showing = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
    ])
    const unlocked = queueReducer(showing, { type: 'UNLOCK', id: 'contact_found' })
    expect(unlocked.queue.map(p => p.id)).toEqual(['contact_found', 'about_scroll'])
  })
})

describe('hydrated 标志', () => {
  it('初始是 false，HYDRATE 之后是 true', () => {
    expect(initialQueueState.hydrated).toBe(false)
    const s = queueReducer(initialQueueState, { type: 'HYDRATE', completed: [] })
    expect(s.hydrated).toBe(true)
  })

  it('存储为空时也置 true —— 否则首访用户的解锁音永远不响', () => {
    /*
      原实现是 `if (stored.length > 0) dispatch(HYDRATE)`。解锁音的基线要等
      hydrated，所以空存储不派发就等于首访用户永远没有基线。
    */
    const s = queueReducer(initialQueueState, { type: 'HYDRATE', completed: [] })
    expect(s.hydrated).toBe(true)
    expect(s.completed).toEqual([])
  })

  it('后续动作不会把它改回 false', () => {
    const s = run([
      { type: 'HYDRATE', completed: ['about_scroll'] },
      { type: 'SHOW_TUTORIAL', id: 'contact_found', scope: 'room:contact' },
      { type: 'UNLOCK', id: 'contact_found' },
      { type: 'DISMISS' },
      { type: 'TICK', delta: 100 },
    ])
    expect(s.hydrated).toBe(true)
  })
})

describe('教程不设自动时限', () => {
  it('durationFor 对教程返回无穷 —— 那个 9000 从来没生效过', () => {
    /*
      `DURATIONS.tutorial = 9000` 是死配置：`TICK` 里对 `kind === 'tutorial'`
      直接 return。留着它会让下一个人以为教程 9 秒后自动消失，然后去查"为什么
      它不消失"。删掉数字、让 `durationFor` 如实返回无穷。
    */
    expect(durationFor('tutorial')).toBe(Number.POSITIVE_INFINITY)
    expect(durationFor('completed')).toBe(DURATIONS.completed)
  })

  it('教程气泡跑很久也不会自己淡出', () => {
    const s = run([
      { type: 'SHOW_TUTORIAL', id: 'about_scroll', scope: 'room:about' },
      ...Array.from({ length: 200 }, () => ({ type: 'TICK' as const, delta: 100 })),
    ])
    expect(activePopup(s)?.id).toBe('about_scroll')
    expect(activePopup(s)?.hiding).toBe(false)
  })
})
