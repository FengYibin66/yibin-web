import {
  useCallback,
  useEffect,
  useRef,
} from 'react'

import type { RoomId } from '@/context/SceneContext'
import {
  decideDoorEntry,
  type DoorEntryCommand,
} from '@/lib/lab/doorEntryFlow'
import { isDoorEntryOwner, type RoomLoadState } from '@/lib/lab/roomLoadMachine'

export const ROOM_LOAD_TIMEOUT_MS = 8000
export const ROOM_LOAD_TIMEOUT_MESSAGE = 'Room loading timed out'

interface DoorEntryOrchestratorOptions {
  roomId: RoomId
  segmentIndex: number
  roomLoadState: RoomLoadState
  isEntryOwner: boolean
  isFastTeleport: boolean
  markRoomOpening: () => void
  timeoutRoomLoad: (message: string) => void
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  flyIntoRoom: (fastMode: boolean) => void
  onFailureReset: (commands: DoorEntryCommand[]) => void
}

interface DoorEntryOrchestratorControls {
  clearLoadTimeout: () => void
}

export function useDoorEntryOrchestrator({
  roomId,
  segmentIndex,
  roomLoadState,
  isEntryOwner,
  isFastTeleport,
  markRoomOpening,
  timeoutRoomLoad,
  openDoorPanels,
  flyIntoRoom,
  onFailureReset,
}: DoorEntryOrchestratorOptions): DoorEntryOrchestratorControls {
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openingAttemptRef = useRef<number | null>(null)
  const previousPhaseRef = useRef(roomLoadState.phase)
  const ownedEntryRef = useRef(false)

  const clearLoadTimeout = useCallback(() => {
    if (!loadTimeoutRef.current) return
    clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = null
  }, [])

  useEffect(() => {
    if (isEntryOwner) {
      ownedEntryRef.current = true
      return
    }
    if (ownedEntryRef.current && !isDoorEntryOwner(roomLoadState, roomId, segmentIndex)) {
      ownedEntryRef.current = false
      clearLoadTimeout()
      openingAttemptRef.current = null
    }
  }, [clearLoadTimeout, isEntryOwner, roomId, roomLoadState, segmentIndex])

  useEffect(() => {
    if (!ownedEntryRef.current) return
    if (roomLoadState.phase !== 'loading' || roomLoadState.roomId !== roomId) return

    clearLoadTimeout()
    loadTimeoutRef.current = setTimeout(() => {
      if (ownedEntryRef.current) {
        timeoutRoomLoad(ROOM_LOAD_TIMEOUT_MESSAGE)
      }
    }, ROOM_LOAD_TIMEOUT_MS)
    return clearLoadTimeout
  }, [clearLoadTimeout, roomId, roomLoadState.attempt, roomLoadState.phase, roomLoadState.roomId, timeoutRoomLoad])

  useEffect(() => {
    if (!ownedEntryRef.current) return
    if (roomLoadState.phase !== 'ready' || roomLoadState.roomId !== roomId) return
    if (openingAttemptRef.current === roomLoadState.attempt) return

    openingAttemptRef.current = roomLoadState.attempt
    markRoomOpening()
    openDoorPanels(isFastTeleport, () => flyIntoRoom(isFastTeleport))
  }, [flyIntoRoom, isFastTeleport, markRoomOpening, openDoorPanels, roomId, roomLoadState.attempt, roomLoadState.phase, roomLoadState.roomId])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = roomLoadState.phase
    if (!ownedEntryRef.current) return
    if (previousPhase !== 'failed' || roomLoadState.phase !== 'idle') return

    onFailureReset(decideDoorEntry({ type: 'BACK' }).commands)
    ownedEntryRef.current = false
    clearLoadTimeout()
    openingAttemptRef.current = null
  }, [clearLoadTimeout, onFailureReset, roomLoadState.phase])

  useEffect(() => clearLoadTimeout, [clearLoadTimeout])

  return { clearLoadTimeout }
}
