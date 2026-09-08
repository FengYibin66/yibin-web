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
  /** 当前停靠点的字幕键；行进中是下一站的 */
  readonly caption: TourCaptionKey | null
  readonly stopId: string | null
}

const IDLE: TourState = { running: false, caption: null, stopId: null }

export function useTour() {
  const { mode, startTour: machineStart, endTour: machineEnd } = useScene()
  const { unlockAchievement } = useAchievementActions()
  const motionScale = useMotionScale()
  const [state, setState] = useState<TourState>(IDLE)
  /** 本次路线的取消令牌：每次开始换一个，旧的 await 醒来后发现不是自己就退出 */
  const runToken = useRef(0)

  const finish = useCallback((reason: 'done' | 'input') => {
    runToken.current += 1
    corridorRailRelease(OWNER)
    machineEnd(reason)
    setState(IDLE)
  }, [machineEnd])

  const start = useCallback(async () => {
    if (!machineStart()) return false
    const token = ++runToken.current
    const onInput = () => finish('input')
    if (!corridorRailHold(OWNER, onInput)) {
      machineEnd('input')
      return false
    }

    const rail = getRail()
    const legs = tourPlan(rail.z, Math.max(0, segmentIndexAtZ(rail.z)), motionScale === 0)
    setState({ running: true, caption: legs[0]?.stop.captionKey ?? null, stopId: null })

    try {
      for (const leg of legs) {
        if (runToken.current !== token) return true
        setState({ running: true, caption: leg.stop.captionKey, stopId: null })
        await corridorRailScrollTo(leg.targetZ, { duration: leg.travelMs / 1000 })
        if (runToken.current !== token) return true
        setState({ running: true, caption: leg.stop.captionKey, stopId: leg.stop.id })
        await new Promise<void>(resolve => setTimeout(resolve, leg.dwellMs))
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
    状态机侧被别的边带走（路线中点门 → entering）：控制器跟着收尾，
    否则导轨还被 hold 着、字幕还在。
  */
  useEffect(() => {
    if (state.running && mode !== 'touring') finish('input')
  }, [mode, state.running, finish])

  useEffect(() => () => { corridorRailRelease(OWNER) }, [])

  return { ...state, start, stop: () => finish('input') }
}
