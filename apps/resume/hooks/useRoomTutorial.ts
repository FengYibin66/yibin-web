'use client'

import { useEffect } from 'react'

import { useAchievementActions } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'

const ROOM_TUTORIAL_DELAY_MS = 2000

/**
 * 进房 2 秒后弹一条房间教程，**离开这间房时它自动消失**。
 *
 * 教程气泡刻意不设自动时限（它在等用户照着做），所以「什么时候关掉」必须有人负责。
 * 漏掉一处不是「多一个气泡」而是**教程系统整体失效**：残留的气泡占着队首，
 * 后面房间的教程永远显示不出来，而没有任何症状指向队列。
 *
 * 两条独立路径保证它消失，任一条生效就够：本 hook 的清理（依赖组件正常卸载，
 * 而传送时房间可能被整棵子树替换）、以及 `enterScope()` 的整批出队。
 *
 * @param tutorialId 成就 id，同时是教程文案的 key。`null` = 这个房间没有教程
 * @param roomId 这间房的 id，用于构造作用域
 */
export function useRoomTutorial(tutorialId: string | null, roomId: string): void {
  const { roomLoadState: { phase } } = useScene()
  const { showTutorial, dismissTutorial } = useAchievementActions()

  useEffect(() => {
    // `null` = 这个房间没有教程（gallery 走独立路由，没有"房间内"这回事）
    if (tutorialId === null) return
    if (phase !== 'entered') return

    const tutorialTimer = window.setTimeout(
      () => showTutorial(tutorialId, `room:${roomId}`),
      ROOM_TUTORIAL_DELAY_MS,
    )

    return () => {
      window.clearTimeout(tutorialTimer)
      // 定时器已经触发过的话，气泡已经在队列里 —— 出队而不是只清定时器
      dismissTutorial(tutorialId)
    }
  }, [phase, showTutorial, dismissTutorial, tutorialId, roomId])
}
