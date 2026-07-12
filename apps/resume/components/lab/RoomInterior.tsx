'use client'

import { useCallback, type ReactNode } from 'react'
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
  isExiting: boolean
}

type RoomProps = Pick<RoomInteriorProps, 'showRoom' | 'onReady' | 'isExiting'>

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

export function RoomInterior({ roomId, showRoom, onReady, isExiting }: RoomInteriorProps) {
  const {
    roomLoadState,
    markRoomAligned,
    markRoomReady,
    failRoomLoad,
  } = useScene()
  const props = { showRoom, onReady, isExiting }

  const handleLoading = useCallback(() => {
    if (roomLoadState.phase === 'aligning') {
      markRoomAligned()
    }
  }, [markRoomAligned, roomLoadState.phase])

  const handleReady = useCallback(() => {
    if (roomLoadState.phase === 'loading') {
      markRoomReady()
    }
    onReady()
  }, [markRoomReady, onReady, roomLoadState.phase])

  return (
    <RoomReadyBoundary
      key={`${roomId}:${roomLoadState.attempt}`}
      attempt={roomLoadState.attempt}
      onLoading={handleLoading}
      onReady={handleReady}
      onError={failRoomLoad}
    >
      {renderRoom(roomId, props)}
    </RoomReadyBoundary>
  )
}
