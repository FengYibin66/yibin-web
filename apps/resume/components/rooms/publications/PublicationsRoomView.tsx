'use client'

import { PublicationsRoom } from './PublicationsRoom'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/** 见 `components/rooms/AboutRoomView.tsx` 的注释 */
export function PublicationsRoomView({ phase }: RoomViewProps) {
  return <PublicationsRoom showRoom isExiting={phase === 'exiting'} />
}

export default PublicationsRoomView
