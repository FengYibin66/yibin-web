'use client'

import type { RoomId } from '@/context/SceneContext'
import { useScene } from '@/context/SceneContext'
import { RoomReadyBoundary } from '@/components/lab/RoomReadyBoundary'
import { RoomAmbience } from '@/components/lab/RoomAmbience'
import { ROOM_VIEWS } from '@/components/rooms/registry'
import { useRoomTutorial } from '@/hooks/useRoomTutorial'
import { ROOMS } from '@/lib/lab/domain/rooms'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

interface RoomInteriorProps {
  roomId: RoomId
  showRoom: boolean
  onReady: () => void
  onLoading?: () => void
  onError?: (message: string) => void
  isExiting: boolean
}

const NOOP = () => {}

/**
 * 房间视图的挂载点 —— **按注册表分发，没有 switch**（ADR 20260903211338）。
 *
 * ## 这里原先是什么
 *
 * 一个硬编码的 `switch (roomId)` 加五个静态 import，其中 `case 'gallery': return null`。
 * 而 `RoomDefinition.view` 字段**从未被任何代码消费**——全仓 `grep '\.view('`
 * 零命中。也就是说 ADR 20260903140615 的「编排代码只消费声明」在渲染这条路径上
 * 从来没有成立过，而它被写进 `AGENTS.md` 的状态表里当成了「已落地」。
 *
 * 换成注册表之后：
 *
 * - 加一个房间不用动这个文件（只改 `components/rooms/registry.ts` 的一行）
 * - 四个房间各自的纹理与几何进各自的 chunk，不再全部塞进 Lab 首屏
 * - `gallery` 的特例分支消失：它的视图是一个执行 `router.push` 的空组件，
 *   `assets` 是空数组，于是它在这条路径上与别的房间没有区别
 *
 * ## `phase` 取代了两个布尔
 *
 * `RoomViewProps.phase` 是 `RoomDefinition` 早就声明好的形态。这里把
 * `showRoom` / `isExiting` 两个布尔加场景相位翻成它——四个适配层
 * （`*RoomView.tsx`）再翻回各房间组件当前的 props。适配层存在的意义就是让
 * 「注册表的契约」与「房间内部结构」解耦：房间内部怎么改，注册表这一侧不用动。
 */
export function RoomInterior({
  roomId,
  showRoom,
  onReady,
  onLoading = NOOP,
  onError = NOOP,
  isExiting,
}: RoomInteriorProps) {
  const { roomLoadState: { attempt, phase: scenePhase } } = useScene()

  /*
    教程也从注册表读，而且在**这里**调而不是各房间自己调。

    `RoomDefinition.tutorial` 此前同样零消费者：四个房间各自硬编码
    `useRoomTutorial('contact_found', 'contact')` 这样的字面量。收到这里之后，
    「哪个房间弹哪条教程」只有注册表一处声明，而作用域（`room:<id>`）由 roomId
    直接派生——不可能写错成别的房间。
  */
  useRoomTutorial(ROOMS[roomId].tutorial, roomId)

  const View = ROOM_VIEWS[roomId]
  const phase = viewPhase({ showRoom, isExiting, scenePhase })

  return (
    <>
      {/*
        环境音**刻意放在 RoomReadyBoundary 之外**。

        这是审计 A5 的核心：原先环境音是各房间内部的 drei `<PositionalAudio>`，
        它走 `useLoader` 会 Suspend——于是 Projects 的 2.35MB 与 Contact 的
        1.66MB 音频挂在房间的 Suspense 边界里，8 秒加载超时很容易被一段装饰性
        音频撑爆。放在边界外之后，房间 READY 与音频彻底解耦。
      */}
      <RoomAmbience
        ambience={ROOMS[roomId].ambience}
        active={showRoom && !isExiting}
      />
      <RoomReadyBoundary
        key={`${roomId}:${attempt}`}
        attempt={attempt}
        onLoading={onLoading}
        onReady={onReady}
        onError={onError}
      >
        {/*
          `lazy` 的 chunk 由 `RoomReadyBoundary` 自己那层 Suspense 接。

          我一度在这里再套一层 `<Suspense fallback={null}>`，想把"下载房间代码"
          与"加载房间纹理"分开。那是错的：内层边界会把**房间自己**抛出的 promise
          （drei 的 `useTexture` 就是这么挂起的）先接掉，于是
          `RoomReadyBoundary` 再也看不到"加载中"——`onLoading` 不触发，加载指示器
          与 8 秒超时的判据一起失效。`roomReadyBoundary.test.tsx` 抓到了这一点。

          让同一层接两者也是语义上对的：「房间还没准备好」本来就该包含它的代码
          和它的纹理，用户不关心慢在哪一段。
        */}
        <View phase={phase} />
      </RoomReadyBoundary>
    </>
  )
}

/** 把两个布尔加场景相位翻成 `RoomViewProps.phase` */
function viewPhase({
  showRoom,
  isExiting,
  scenePhase,
}: {
  showRoom: boolean
  isExiting: boolean
  scenePhase: string
}): RoomViewProps['phase'] {
  if (isExiting || scenePhase === 'exiting') return 'exiting'
  if (scenePhase === 'entered') return 'entered'
  return showRoom ? 'ready' : 'mounting'
}
