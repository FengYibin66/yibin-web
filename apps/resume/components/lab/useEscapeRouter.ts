'use client'

import { useEffect } from 'react'

import { useScene } from '@/context/SceneContext'
import { consumeEscape } from '@/lib/lab/app/escapeStack'

/**
 * Lab 里 **唯一** 的 ESC 监听点（ADR 20260903211244）。语义是「关掉最内层
 * 打开的那个东西」：先给消费栈的栈顶，没人认领才退出房间。
 *
 * 收成一个监听点之后，「谁先谁后」不再取决于 effect 的注册顺序——那是原设计
 * 最脆的一环（`NavigationUI` 的监听依赖面板 state，每次开关都摘掉再挂上，
 * 它在监听队列里的位置随用户操作漂移）。
 *
 * 退房不需要额外守卫：`requestExit()` 自己守着
 * `phase === 'entered' && !isTeleporting`。多一套并行守卫就多一处漂移的可能。
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
