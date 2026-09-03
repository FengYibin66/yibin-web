'use client'

import type { ReactNode } from 'react'
import type { RoomId } from '@/context/SceneContext'
import { useScene } from '@/context/SceneContext'
import { AboutRoom } from '@/components/rooms/AboutRoom'
import { ProjectsRoom } from '@/components/rooms/projects/ProjectsRoom'
import {
  PublicationsRoom,
} from '@/components/rooms/publications/PublicationsRoom'
import { ContactRoom } from '@/components/rooms/ContactRoom'
import { RoomReadyBoundary } from '@/components/lab/RoomReadyBoundary'
import { RoomAmbience } from '@/components/lab/RoomAmbience'
import { ROOMS } from '@/lib/lab/domain/rooms'

interface RoomInteriorProps {
  roomId: RoomId
  showRoom: boolean
  onReady: () => void
  onLoading?: () => void
  onError?: (message: string) => void
  isExiting: boolean
}

type RoomProps = Pick<RoomInteriorProps, 'showRoom' | 'isExiting'>

const NOOP = () => {}

function renderRoom(roomId: RoomId, props: RoomProps): ReactNode {
  switch (roomId) {
    case 'about':
      return <AboutRoom {...props} />
    case 'projects':
      return <ProjectsRoom {...props} />
    case 'publications':
      return <PublicationsRoom {...props} />
    case 'contact':
      return <ContactRoom {...props} />
    case 'gallery':
      // Gallery is rendered outside Canvas in LabScene.tsx.
      return null
  }
}

export function RoomInterior({
  roomId,
  showRoom,
  onReady,
  onLoading = NOOP,
  onError = NOOP,
  isExiting,
}: RoomInteriorProps) {
  const { roomLoadState: { attempt } } = useScene()
  const props = { showRoom, isExiting }

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
        {renderRoom(roomId, props)}
      </RoomReadyBoundary>
    </>
  )
}
