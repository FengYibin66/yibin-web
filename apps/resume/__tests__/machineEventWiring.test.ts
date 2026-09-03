import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { eventTypeLiterals, walkSources } from './helpers/sourceScan'
import { roomMachine } from '@/lib/lab/domain/machines/room.machine'

/**
 * 门禁：状态机声明的每个事件，运行时都得有人发。
 *
 * ## 这条门禁抓到过什么
 *
 * 接线 `room.machine` 时（ADR 20260903211338）漏了 `MOUNTED`：`RoomInterior`
 * 的 `onLoading` 默认值是 NOOP，而 `DoorSection` 没传它。后果不是"少一个回调"，
 * 而是：
 *
 * - `mounting --MOUNTED--> loading` 这条边没人走 → `loading` **在生产里不可达**
 * - 8 秒加载超时是 `loading` 状态的 `after` → **超时永远不会启动**
 *
 * 而所有测试都是绿的：机器测试直接 `send({type:'MOUNTED'})`，全路径覆盖也照样
 * 走过那条边——**图上有边不等于运行时有人发**。这正是这整个 PR 在修的那类问题
 * （「已定义、未接线」），只不过这次的粒度是单个事件而不是整个模块。
 *
 * ## 为什么是源码扫描而不是运行时断言
 *
 * 「这个事件有没有人发」是关于整个代码库的性质，运行时只能观察到被执行的那条
 * 路径。弱网 + 缓存未命中才会走 `MOUNTED`，headless E2E 里几乎必然命中缓存
 * ——靠 E2E 覆盖它等于靠运气。
 *
 * ## 已知边界
 *
 * 认的是字面量 `type: 'X'`，且必须是**真的对象属性**——第一版按文本匹配，于是
 * 一句解释旧实现的注释被当成了 `BACK` 的发送方，4 条 `BACK` 边全是死的而门禁
 * 绿着。改走 AST（`eventTypeLiterals`）之后才暴露出来。
 *
 * 事件类型若由变量拼出来（`{type: eventName}`）仍看不见。目前没有这种写法，
 * 出现了就该在这里加一条断言而不是放宽这条。
 */

const RUNTIME_DIRS = ['app', 'components', 'context', 'hooks', 'lib']

/**
 * 机器**定义**本身不算发送方。
 *
 * `room.machine.ts` 里的事件联合类型写成 `| { type: 'MOUNTED' }`，形状与调用点
 * 的 `send({ type: 'MOUNTED' })` 一样，正则分不开。第一版就是这么假绿的：
 * 摘掉真实发送方之后门禁仍然通过，因为机器自己声明过那个名字。
 */
const MACHINE_DEFINITION_DIR = join('lib', 'lab', 'domain', 'machines')

/** 运行时源码里出现过的所有 `type: 'X'` 字面量（不含机器定义自身） */
function runtimeEventLiterals(): Set<string> {
  const found = new Set<string>()
  for (const dir of RUNTIME_DIRS) {
    for (const file of walkSources(join(process.cwd(), dir))) {
      if (file.includes(MACHINE_DEFINITION_DIR)) continue
      for (const event of eventTypeLiterals(readFileSync(file, 'utf8'), file)) {
        found.add(event)
      }
    }
  }
  return found
}

/**
 * 机器自己内部产生、外部不该发的事件。
 *
 * 目前只有 `after` 的定时器（`xstate.after.*`），它由 XState 自己排程。
 * 这个清单只能是"机器内部产生"的那些，**不能用来放过忘了接线的事件**。
 */
const MACHINE_INTERNAL = /^xstate\./

describe('room.machine 的每个事件都有运行时发送方', () => {
  const declared = roomMachine.events.filter(e => !MACHINE_INTERNAL.test(e))

  it('前置：机器确实声明了一批事件（否则下面那条会空转通过）', () => {
    expect(declared.length).toBeGreaterThan(8)
  })

  it('没有一个事件是只在测试里出现的', () => {
    const sent = runtimeEventLiterals()
    const orphans = declared.filter(e => !sent.has(e))
    expect(
      orphans,
      `这些事件运行时没人发，它们的边在生产里不可达：${orphans.join(', ')}`,
    ).toEqual([])
  })

  it('扫描器本身能发现缺失 —— 变异测试', () => {
    /*
      不去改源码，而是拿一个机器里有、源码里必然没有的名字问同样的问题。
      这条防的是 `runtimeEventLiterals()` 因为路径写错、正则失配之类原因
      返回一个"什么都命中"的集合，从而让上一条永远绿。
    */
    const sent = runtimeEventLiterals()
    expect(sent.has('EVENT_THAT_NOBODY_SENDS'), '扫描器命中了不存在的事件').toBe(false)
    expect(sent.size, '扫描器什么都没扫到，上一条是空转通过的').toBeGreaterThan(10)
  })
})
