import { useEffect, useRef } from 'react'

import type { RoomId, RoomLoadState } from '@/context/SceneContext'

/**
 * 加载超时的错误**码**，不是给用户看的文案。
 *
 * 原先这里是英文散文 `'Room loading timed out'`，一路传到 UI 直接显示——
 * 中文用户看到的就是英文（审计 E7）。跨层传递的错误标识应当是码，
 * 翻译在显示层做（`RoomLoadingIndicator` 把它映射到 `labUi.hints.loadTimedOut`）。
 */
export const ROOM_LOAD_TIMEOUT_CODE = 'room-load-timeout'

interface DoorEntryOrchestratorOptions {
  roomId: RoomId
  roomLoadState: RoomLoadState
  isEntryOwner: boolean
  isFastTeleport: boolean
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  flyIntoRoom: (fastMode: boolean) => void
}

/**
 * 门开合动画的触发时机 —— **只剩这一件事**（ADR 20260903211338）。
 *
 * ## 删掉了什么
 *
 * 这个 hook 原先有 5 个 effect 和 4 个 ref，其中三件已经由状态图接管：
 *
 * 1. **8 秒加载超时**：`loadTimeoutRef` + 一个 `setTimeout` + 一个 effect 负责
 *    在 `loading` 相位开始时起、在别的相位清。现在是 `loading` 状态的一行
 *    `after: { 8000: 'failed' }`。
 * 2. **进房所有权**：`ownedEntryRef` 记着"我是不是这次进房的门"，靠另一个 effect
 *    在相位变化时维护。现在由机器 context 派生（`isDoorEntryOwner`）。
 * 3. **失败复位**：`previousPhaseRef` 记上一次相位，靠观察 `failed → idle` 这次
 *    转移来复位另外两个 ref。**这是一个真实缺陷的来源**——中间只要插进一次别的
 *    渲染，`previousPhase` 就被覆盖、复位永远不发生，表现是「从加载失败退出后
 *    再也传送不了」（`e2e/lab.spec.ts` 里那条 `test.fail` 抓的就是它）。
 *    机器里 `failed --RESET--> idle` 是一条显式边，没有需要复位的影子状态。
 *
 * 剩下的这一件必须留在 React 里：开门是 DOM/gsap 动画，机器不该知道它。
 *
 * ## 为什么还要 `openedAttemptRef`
 *
 * 「每次 attempt 只开一次门」不是状态，是**副作用的幂等保护**：`ready` 相位会
 * 因为别的 state 变化而多次渲染，而开门动画重放会让门板抖一下。用 attempt 号
 * 而不是布尔，是因为重试会回到 `loading` 再到 `ready`，那时该重新开门。
 */
export function useDoorEntryOrchestrator({
  roomId,
  roomLoadState,
  isEntryOwner,
  isFastTeleport,
  openDoorPanels,
  flyIntoRoom,
}: DoorEntryOrchestratorOptions): void {
  const openedAttemptRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isEntryOwner) return
    if (roomLoadState.phase !== 'ready' || roomLoadState.roomId !== roomId) return
    if (openedAttemptRef.current === roomLoadState.attempt) return

    openedAttemptRef.current = roomLoadState.attempt
    openDoorPanels(isFastTeleport, () => flyIntoRoom(isFastTeleport))
  }, [
    flyIntoRoom,
    isEntryOwner,
    isFastTeleport,
    openDoorPanels,
    roomId,
    roomLoadState.attempt,
    roomLoadState.phase,
    roomLoadState.roomId,
  ])

  /*
    回到 idle 就清掉幂等标记，让下一次进房能重新开门。

    这一条与旧实现的 `previousPhaseRef` 不同：它只看**当前**相位是不是 idle，
    不需要"观察到某次转移"。少一个只能看见一帧的判据，就少一处漏掉就永久卡住
    的地方。
  */
  useEffect(() => {
    if (roomLoadState.phase === 'idle') openedAttemptRef.current = null
  }, [roomLoadState.phase])
}
