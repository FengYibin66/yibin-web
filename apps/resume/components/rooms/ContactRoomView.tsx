'use client'

import { ContactRoom } from './ContactRoom'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/** 见 `AboutRoomView` 的注释 */
export function ContactRoomView({ phase }: RoomViewProps) {
  return <ContactRoom showRoom isExiting={phase === 'exiting'} />
}

export default ContactRoomView
