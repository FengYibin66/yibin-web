import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { memberCalls, scanTree } from './helpers/sourceScan'

/**
 * 全仓禁止 `ScrollTrigger.getAll()`（ADR 20260907120701）。
 *
 * 2026-09-07 的实机事故：`ClassicPage` 的 cleanup 写成 `ScrollTrigger.getAll().forEach(t => t.kill())`。
 * 两个问题叠在一起：
 *   - `getAll()` 不分归属，会把**别的组件**（根 layout 的 `SmoothScrollProvider`）
 *     的触发器一起杀掉；
 *   - `ScrollTrigger.kill()` 默认连带杀掉关联的 tween。dev 的 StrictMode 把 effect
 *     跑两遍，播放中的 tween 被杀在半路，第二次注册的 `gsap.from` 把残值当终点
 *     ——卡片停在 3%–83% 透明度。
 *
 * 规则：每个 GSAP 使用方用 `gsap.context()` 持有自己创建的一切，cleanup 只
 * `revert()` 自己的。`getAll()` 唯一合理的用途是**读**（诊断），而仓库里没有这种
 * 用法，所以整个方法直接禁掉比区分读写简单且不会漏。
 *
 * 与其余门禁同一形态：AST 而不是正则（注释里的同形文本不算，见 ADR 20260903211320）。
 * 无棘轮——当前基线是 0，要加回来先来这里解释为什么。
 */
const ROOT = join(import.meta.dirname, '..')
const DIRS = ['app', 'components', 'hooks', 'lib', 'context'] as const

describe('ScrollTrigger.getAll 零调用', () => {
  it('app / components / hooks / lib / context 里没有 ScrollTrigger.getAll(', () => {
    const hits = scanTree(ROOT, DIRS, (src, file) => memberCalls(src, 'ScrollTrigger', 'getAll', file))
    const listing = [...hits.entries()].flatMap(([file, arr]) => arr.map(h => `${file}:${h.line}  ${h.text}`))
    expect(listing, '清全局的写法会杀掉别人的触发器与播放中的 tween，用 gsap.context().revert()').toEqual([])
  })

  it('查询本身能抓到真实写法 —— 否则上面那条是空断言', () => {
    const sample = `
      import { ScrollTrigger } from 'gsap/ScrollTrigger'
      export function bad() { ScrollTrigger.getAll().forEach(t => t.kill()) }
      // ScrollTrigger.getAll() 在注释里不算
      const s = 'ScrollTrigger.getAll()'
    `
    const hits = memberCalls(sample, 'ScrollTrigger', 'getAll', 'sample.ts')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.line).toBe(3)
  })
})
