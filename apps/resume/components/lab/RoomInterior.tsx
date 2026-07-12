'use client'

import type { ReactNode } from 'react'
import type { RoomId } from '@/context/SceneContext'
import { useScene } from '@/context/SceneContext'
import { AboutRoom } from '@/components/rooms/AboutRoom'
import { ProjectsRoom } from '@/components/rooms/ProjectsRoom'
import { PublicationsRoom } from '@/components/rooms/PublicationsRoom'
import { ContactRoom } from '@/components/rooms/ContactRoom'
import { RoomReadyBoundary } from '@/components/lab/RoomReadyBoundary'

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
    <RoomReadyBoundary
      key={`${roomId}:${attempt}`}
      attempt={attempt}
      onLoading={onLoading}
      onReady={onReady}
      onError={onError}
    >
      {renderRoom(roomId, props)}
    </RoomReadyBoundary>
  )
}
