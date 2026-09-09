'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAchievementActions } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useMotionScale } from '@/hooks/useMotionScale'
import {
  corridorRailHold,
  corridorRailRelease,
  corridorRailScrollTo,
} from '@/lib/lab/app/camera/corridorRail'
import { getRail } from '@/lib/lab/app/stores/corridorStore'
import { pushEscapeConsumer } from '@/lib/lab/app/escapeStack'
import { segmentIndexAtZ } from '@/lib/lab/domain/corridor/layout'
import { tourPlan, type TourCaptionKey } from '@/lib/lab/domain/corridor/tour'

/**
 * 招聘官路线的控制器（ADR 20260908204302，规格 lab-corridor-story.md §5）。
 *
 * 分工：
 * - **互斥**归 `corridor.machine`（`startTour` 被拒就是不该开始的时候）
 * - **运动**归导轨（`scrollTo` / `hold`；相机一下都不碰）
 * - **内容**归 domain（`tourPlan`）
 * - 这里只按计划顺序调命令，并把"当前在哪一站"交给 UI 画字幕
 *
 * 任何用户输入（滚轮 / 键盘 / 触摸经导轨的 hold 回调；ESC 经 escapeStack；点门经
 * `DOOR_CLICK`）都在当帧结束路线；正在进行的 `scrollTo` 被 release 打断，相机停在
 * 当前位置不回弹。
 */

const OWNER = 'tour'

export interface TourState {
  readonly running: boolean
  /** 当前停靠点的字幕键；行进中是下一站的；走完后是 `end`，常驻到下一次输入 */
  readonly caption: TourCaptionKey | null
  readonly stopId: string | null
  /** 第几站 / 共几站（1 起），字幕里的小计数：没有它访客不知道还要等多久（UX 评审） */
  readonly index: number
  readonly total: number
}

const IDLE: TourState = { running: false, caption: null, stopId: null, index: 0, total: 0 }
/** 走完了：导轨已还给玩家，最后一句留着告诉他下一步 */
const ENDED: TourState = { running: false, caption: 'end', stopId: 'end', index: 0, total: 0 }

export function useTour() {
  const { mode, startTour: machineStart, endTour: machineEnd } = useScene()
  const { unlockAchievement } = useAchievementActions()
  const motionScale = useMotionScale()
  const [state, setState] = useState<TourState>(IDLE)
  /** 本次路线的取消令牌：每次开始换一个，旧的 await 醒来后发现不是自己就退出 */
  const runToken = useRef(0)
  /** 停留用的定时器，取消时清掉（不然最多留 5 s 的悬挂闭包） */
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = useCallback((reason: 'done' | 'input') => {
    runToken.current += 1
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current)
      dwellTimer.current = null
    }
    corridorRailRelease(OWNER)
    machineEnd(reason)
    setState(reason === 'done' ? ENDED : IDLE)
  }, [machineEnd])

  /*
    走完之后最后一句常驻：结束那一刻画面停在段末门前，没有这句访客不知道下一步。
    任何输入（导轨已释放，所以这里自己听）清掉它。
  */
  useEffect(() => {
    if (state.running || state.caption !== 'end') return
    const clear = () => setState(IDLE)
    const opts = { passive: true, once: true } as const
    window.addEventListener('wheel', clear, opts)
    window.addEventListener('keydown', clear, opts)
    window.addEventListener('touchstart', clear, opts)
    window.addEventListener('pointerdown', clear, opts)
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('keydown', clear)
      window.removeEventListener('touchstart', clear)
      window.removeEventListener('pointerdown', clear)
    }
  }, [state.running, state.caption])

  const start = useCallback(async () => {
    // 先拿导轨再进状态机：拿不到（别人持有 / 未挂载）什么都不该变
    const onInput = () => finish('input')
    if (!corridorRailHold(OWNER, onInput)) return false
    if (!machineStart()) {
      corridorRailRelease(OWNER)
      return false
    }
    const token = ++runToken.current

    const rail = getRail()
    const legs = tourPlan(rail.z, Math.max(0, segmentIndexAtZ(rail.z)), motionScale === 0)
    const total = legs.length
    setState({ running: true, caption: legs[0]?.stop.captionKey ?? null, stopId: null, index: 1, total })

    try {
      for (const [i, leg] of legs.entries()) {
        if (runToken.current !== token) return true
        setState({ running: true, caption: leg.stop.captionKey, stopId: null, index: i + 1, total })
        await corridorRailScrollTo(leg.targetZ, { duration: leg.travelMs / 1000 })
        if (runToken.current !== token) return true
        setState({ running: true, caption: leg.stop.captionKey, stopId: leg.stop.id, index: i + 1, total })
        await new Promise<void>(resolve => {
          dwellTimer.current = setTimeout(() => {
            dwellTimer.current = null
            resolve()
          }, leg.dwellMs)
        })
      }
      if (runToken.current !== token) return true
      unlockAchievement('tour_complete')
      finish('done')
    } catch {
      // scrollTo 被 release 打断（用户输入）：finish 已由 onInput 调过
      if (runToken.current === token) finish('input')
    }
    return true
  }, [machineStart, machineEnd, motionScale, unlockAchievement, finish])

  /*
    ESC 走已有的栈：路线运行时登记一个消费者，栈顶先消费——面板开着时 ESC 先关面板，
    与其他地方的行为一致。
  */
  useEffect(() => {
    if (!state.running) return
    return pushEscapeConsumer(() => finish('input'))
  }, [state.running, finish])

  /*
    状态机侧被别的边带走（路线中点门 → entering / 传送）：控制器跟着收尾，
    否则导轨还被 hold 着、字幕还在。

    **只认冲突模式（inRoom / teleporting），不能写成 `mode !== 'touring'`**：
    `running` 在本次渲染就为 true，而 `mode` 要等 SceneProvider 拿到新快照后的下一次
    渲染才变成 `touring`，中间那一帧 `mode` 还是 `free` —— 于是路线刚开始就被自己掐掉
    （CI 的 mobile-safari 上稳定复现：点了脚印，`data-lab-mode` 立刻回 `free`）。
  */
  useEffect(() => {
    if (state.running && (mode === 'inRoom' || mode === 'teleporting')) finish('input')
  }, [mode, state.running, finish])

  useEffect(() => () => { corridorRailRelease(OWNER) }, [])

  return { ...state, start, stop: () => finish('input') }
}
