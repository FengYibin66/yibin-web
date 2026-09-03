'use client'

import { useEffect } from 'react'

import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'

const ROOM_TUTORIAL_DELAY_MS = 2000

/**
 * 进房 2 秒后弹一条房间教程，**离开这间房时它自动消失**。
 *
 * ## 「自动消失」这件事以前是漏的
 *
 * 教程气泡刻意不设自动时限（它在等用户照着做）。但「什么时候该关掉」原先完全
 * 由调用侧负责，而调用侧是四个互不知情的房间组件——结果全仓只有
 * `PublicationsRoom` 在退场时调了 `hidePopup()`。
 *
 * 实际表现：进 About 不滚动 → 2 秒后弹出教程 → 退回走廊 → **气泡一直挂着**；
 * 再进别的房间，它的教程排在队列第二位，**永远显示不出来**。漏掉一处不是
 * 「多一个气泡」，而是**教程系统整体失效**，且没有任何症状指向队列。
 * 审计 A7 记过这条并标为已修，实际只修了一间房。
 *
 * 现在气泡带作用域（`room:<id>`），由两条独立的路径保证它消失：
 *
 * 1. **本 hook 的清理**：房间组件卸载或相位离开 `entered` 时按 id 出队
 * 2. **场景切换**：`enterScope()` 把不属于当前场景的气泡整批出队
 *
 * 两条都在是刻意的——第 1 条依赖组件正常卸载（传送时房间可能被整棵子树替换），
 * 第 2 条不依赖任何组件的生命周期。任一条生效就够。
 *
 * @param tutorialId 成就 id，同时是教程文案的 key
 * @param roomId 这间房的 id，用于构造作用域
 */
export function useRoomTutorial(tutorialId: string, roomId: string): void {
  const { roomLoadState: { phase } } = useScene()
  const { showTutorial, dismissTutorial } = useAchievements()

  useEffect(() => {
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
