import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from 'react'

import type { RoomId } from '@/context/SceneContext'
import {
  decideDoorEntry,
  type DoorEntryCommand,
} from '@/lib/lab/doorEntryFlow'
import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

export const ROOM_LOAD_TIMEOUT_MS = 8000
export const ROOM_LOAD_TIMEOUT_MESSAGE = 'Room loading timed out'

interface DoorEntryOrchestratorOptions {
  roomId: RoomId
  roomLoadState: RoomLoadState
  activeEntryRef: RefObject<boolean>
  isFastTeleport: boolean
  markRoomOpening: () => void
  timeoutRoomLoad: (message: string) => void
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  flyIntoRoom: (fastMode: boolean) => void
  onFailureReset: (commands: DoorEntryCommand[]) => void
}

interface DoorEntryOrchestratorControls {
  clearLoadTimeout: () => void
  releaseEntryOwnership: () => void
}

export function useDoorEntryOrchestrator({
  roomId,
  roomLoadState,
  activeEntryRef,
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

  const clearLoadTimeout = useCallback(() => {
    if (!loadTimeoutRef.current) return
    clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = null
  }, [])

  const releaseEntryOwnership = useCallback(() => {
    clearLoadTimeout()
    openingAttemptRef.current = null
    activeEntryRef.current = false
  }, [activeEntryRef, clearLoadTimeout])

  useEffect(() => {
    if (!activeEntryRef.current) return
    if (roomLoadState.phase !== 'loading' || roomLoadState.roomId !== roomId) return

    clearLoadTimeout()
    loadTimeoutRef.current = setTimeout(() => {
      if (activeEntryRef.current) {
        timeoutRoomLoad(ROOM_LOAD_TIMEOUT_MESSAGE)
      }
    }, ROOM_LOAD_TIMEOUT_MS)
    return clearLoadTimeout
  }, [activeEntryRef, clearLoadTimeout, roomId, roomLoadState.attempt, roomLoadState.phase, roomLoadState.roomId, timeoutRoomLoad])

  useEffect(() => {
    if (!activeEntryRef.current) return
    if (roomLoadState.phase !== 'ready' || roomLoadState.roomId !== roomId) return
    if (openingAttemptRef.current === roomLoadState.attempt) return

    openingAttemptRef.current = roomLoadState.attempt
    markRoomOpening()
    openDoorPanels(isFastTeleport, () => flyIntoRoom(isFastTeleport))
  }, [activeEntryRef, flyIntoRoom, isFastTeleport, markRoomOpening, openDoorPanels, roomId, roomLoadState.attempt, roomLoadState.phase, roomLoadState.roomId])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = roomLoadState.phase
    if (!activeEntryRef.current) return
    if (previousPhase !== 'failed' || roomLoadState.phase !== 'idle') return

    onFailureReset(decideDoorEntry({ type: 'BACK' }).commands)
    releaseEntryOwnership()
  }, [activeEntryRef, onFailureReset, releaseEntryOwnership, roomLoadState.phase])

  useEffect(() => clearLoadTimeout, [clearLoadTimeout])

  return { clearLoadTimeout, releaseEntryOwnership }
}
