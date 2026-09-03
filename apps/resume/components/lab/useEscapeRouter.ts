'use client'

import { useEffect } from 'react'

import { useScene } from '@/context/SceneContext'
import { consumeEscape } from '@/lib/lab/app/escapeStack'

/**
 * Lab 里 **唯一** 的 ESC 监听点（ADR 20260903211244）。
 *
 * ## 语义
 *
 * 「关掉最内层打开的那个东西」。判定顺序只有一条：
 *
 *   1. `consumeEscape()` —— 消费栈的栈顶（面板、教程、停靠、打开的单篇…）
 *   2. 没人认领 → 退出房间
 *
 * ## 为什么必须只有一个监听点
 *
 * 改造前有 **17 个** window keydown 监听在抢 ESC：15 个 `DoorSection` 实例各一个
 * （靠自己的 `isInsideRoom` 互斥）、`NavigationUI` 一个（关面板）、`LabTutorial`
 * 一个（跳过说明）。后三者都不走消费栈也不 `stopPropagation`，于是在房间里按
 * ESC 会**同时**关掉面板并让房间退场——`apps/resume/AGENTS.md` 的「ESC 的优先级」
 * 一节早就写明「自己挂 window 监听会让两者同时触发」，被禁止的形态正是当时的代码。
 *
 * E2E（`e2e/lab.spec.ts`）复现过这条：在房间里开成就面板、按 ESC，面板关了、
 * 房间也退了。第一版测试因为断言查得太早（退房动画要 2–3 秒）而误判为正常，
 * 加上等待后如实复现。
 *
 * 把监听收成一个之后，「谁先谁后」不再取决于 effect 的注册顺序——那是原设计里
 * 最脆的一环：`NavigationUI` 的监听依赖 `[mapOpen, audioOpen, achievementsOpen]`，
 * 每次开关面板都会摘掉再挂上，于是它在监听队列里的位置随用户操作漂移。
 *
 * ## 为什么退房的守卫可以省掉
 *
 * 旧的 `handleDoorEscape` 还查了 `isInsideRoom` / `isAnimating` / `isTeleporting`
 * 三个**每个门实例各自的** state。这里不需要：`requestExit()` 自己就守着
 * `phase === 'entered' && !isTeleporting`——不在房间里、正在退场中（phase 已是
 * `exiting`）、正在传送，三种情况它都直接返回。少一套并行的守卫，也就少一处
 * 两套判断漂移的可能。
 */
export function useEscapeRouter(): void {
  const { requestExit } = useScene()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 栈顶先消费；被消费掉就不再退房
      if (consumeEscape()) return
      requestExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestExit])
}
