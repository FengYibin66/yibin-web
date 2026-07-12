import type { RoomId } from '@/context/SceneContext'

export type RoomLoadPhase =
  | 'idle'
  | 'aligning'
  | 'loading'
  | 'ready'
  | 'opening'
  | 'entered'
  | 'failed'
  | 'exiting'

export interface RoomLoadState {
  phase: RoomLoadPhase
  roomId: RoomId | null
  segmentIndex: number | null
  attempt: number
  error: string | null
}

export type RoomLoadEvent =
  | { type: 'BEGIN'; roomId: RoomId; segmentIndex: number }
  | { type: 'ALIGNED' }
  | { type: 'READY' }
  | { type: 'OPENING' }
  | { type: 'OPENED' }
  | { type: 'EXIT' }
  | { type: 'TELEPORT_RESET' }
  | { type: 'RESET' }
  | { type: 'RETRY' }
  | { type: 'TIMEOUT'; message: string }
  | { type: 'FAIL'; message: string }

export const INITIAL_ROOM_LOAD_STATE: RoomLoadState = {
  phase: 'idle',
  roomId: null,
  segmentIndex: null,
  attempt: 0,
  error: null,
}

export function isDoorEntryOwner(
  state: RoomLoadState,
  roomId: RoomId,
  segmentIndex: number,
): boolean {
  return (
    state.phase !== 'idle'
    && state.roomId === roomId
    && state.segmentIndex === segmentIndex
  )
}

export function roomLoadReducer(
  state: RoomLoadState,
  event: RoomLoadEvent,
): RoomLoadState {
  if (state.phase === 'idle' && event.type === 'BEGIN') {
    return {
      phase: 'aligning',
      roomId: event.roomId,
      segmentIndex: event.segmentIndex,
      attempt: 1,
      error: null,
    }
  }
  if (state.phase === 'aligning' && event.type === 'ALIGNED') {
    return { ...state, phase: 'loading' }
  }
  if (state.phase === 'loading' && event.type === 'READY') {
    return { ...state, phase: 'ready' }
  }
  if (state.phase === 'ready' && event.type === 'OPENING') {
    return { ...state, phase: 'opening' }
  }
  if (state.phase === 'opening' && event.type === 'OPENED') {
    return { ...state, phase: 'entered' }
  }
  if (state.phase === 'entered' && event.type === 'EXIT') {
    return { ...state, phase: 'exiting' }
  }
  if (state.phase === 'entered' && event.type === 'TELEPORT_RESET') {
    return INITIAL_ROOM_LOAD_STATE
  }
  if (
    (state.phase === 'exiting' || state.phase === 'failed') &&
    event.type === 'RESET'
  ) {
    return INITIAL_ROOM_LOAD_STATE
  }
  if (state.phase === 'failed' && event.type === 'RETRY') {
    return {
      ...state,
      phase: 'loading',
      attempt: state.attempt + 1,
      error: null,
    }
  }
  if (
    state.phase === 'loading' &&
    (event.type === 'TIMEOUT' || event.type === 'FAIL')
  ) {
    return { ...state, phase: 'failed', error: event.message }
  }

  throw new Error(
    `Invalid room load transition from ${state.phase} via ${event.type}`,
  )
}
