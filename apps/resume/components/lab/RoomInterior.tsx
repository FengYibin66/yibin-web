'use client'

import { Suspense } from 'react'
import type { RoomId } from '@/context/SceneContext'
import { AboutRoom } from '@/components/rooms/AboutRoom'
import { ProjectsRoom } from '@/components/rooms/ProjectsRoom'
import { PublicationsRoom } from '@/components/rooms/PublicationsRoom'
import { ContactRoom } from '@/components/rooms/ContactRoom'

interface RoomInteriorProps {
  roomId: RoomId
  showRoom: boolean
  onReady: () => void
  isExiting: boolean
}

export function RoomInterior({ roomId, showRoom, onReady, isExiting }: RoomInteriorProps) {
  const props = { showRoom, onReady, isExiting }

  return (
    <Suspense fallback={null}>
      {roomId === 'about'        && <AboutRoom        {...props} />}
      {roomId === 'projects'     && <ProjectsRoom     {...props} />}
      {roomId === 'publications' && <PublicationsRoom {...props} />}
      {/* Gallery is rendered outside Canvas in LabScene.tsx */}
      {roomId === 'contact'      && <ContactRoom      {...props} />}
    </Suspense>
  )
}
