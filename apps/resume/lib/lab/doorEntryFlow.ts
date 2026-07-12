import type { RoomId } from '@/context/SceneContext'

import {
  roomLoadReducer,
  type RoomLoadEvent,
  type RoomLoadState,
} from './roomLoadMachine'

export type DoorEntryCommand =
  | 'ALIGN_CAMERA'
  | 'MOUNT_ROOM'
  | 'START_TIMEOUT'
  | 'OPEN_DOOR'
  | 'ENTER_ROOM'
  | 'ANIMATE_EXIT'
  | 'CLEAR_TIMEOUT'
  | 'RESTORE_CAMERA'
  | 'CLOSE_DOOR'
  | 'RESET_LOCAL_STATE'
  | 'RELEASE_CAMERA_OVERRIDE'

export type DoorEntrySignal =
  | { type: 'CLICK'; roomId: RoomId; segmentIndex: number }
  | { type: 'CAMERA_ALIGNED' }
  | { type: 'ROOM_READY' }
  | { type: 'READY_OBSERVED' }
  | { type: 'ENTRY_COMPLETED' }
  | { type: 'TIMEOUT'; message: string }
  | { type: 'ROOM_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'BACK' }
  | { type: 'EXIT' }
  | { type: 'EXIT_COMPLETED' }

export interface DoorEntryDecision {
  event: RoomLoadEvent
  commands: DoorEntryCommand[]
}

export interface DoorEntryFlowResult {
  state: RoomLoadState
  commands: DoorEntryCommand[]
}

const FAILURE_CLEANUP_COMMANDS: DoorEntryCommand[] = [
  'CLEAR_TIMEOUT',
  'RESTORE_CAMERA',
  'CLOSE_DOOR',
  'RESET_LOCAL_STATE',
  'RELEASE_CAMERA_OVERRIDE',
]

type SimpleSignalType = Exclude<
  DoorEntrySignal['type'],
  'CLICK' | 'TIMEOUT' | 'ROOM_ERROR'
>

const SIMPLE_DECISIONS: Record<SimpleSignalType, DoorEntryDecision> = {
  CAMERA_ALIGNED: {
    event: { type: 'ALIGNED' },
    commands: ['MOUNT_ROOM', 'START_TIMEOUT'],
  },
  ROOM_READY: { event: { type: 'READY' }, commands: [] },
  READY_OBSERVED: { event: { type: 'OPENING' }, commands: ['OPEN_DOOR'] },
  ENTRY_COMPLETED: { event: { type: 'OPENED' }, commands: ['ENTER_ROOM'] },
  RETRY: {
    event: { type: 'RETRY' },
    commands: ['MOUNT_ROOM', 'START_TIMEOUT'],
  },
  BACK: { event: { type: 'RESET' }, commands: FAILURE_CLEANUP_COMMANDS },
  EXIT: { event: { type: 'EXIT' }, commands: ['ANIMATE_EXIT'] },
  EXIT_COMPLETED: { event: { type: 'RESET' }, commands: [] },
}

export function decideDoorEntry(signal: DoorEntrySignal): DoorEntryDecision {
  if (signal.type === 'CLICK') {
    return {
      event: {
        type: 'BEGIN',
        roomId: signal.roomId,
        segmentIndex: signal.segmentIndex,
      },
      commands: ['ALIGN_CAMERA'],
    }
  }
  if (signal.type === 'TIMEOUT' || signal.type === 'ROOM_ERROR') {
    const type = signal.type === 'TIMEOUT' ? 'TIMEOUT' : 'FAIL'
    return { event: { type, message: signal.message }, commands: [] }
  }
  return SIMPLE_DECISIONS[signal.type]
}

export function tryAdvanceDoorEntryFlow(
  state: RoomLoadState,
  signal: DoorEntrySignal,
): DoorEntryFlowResult | null {
  const decision = decideDoorEntry(signal)
  try {
    return {
      state: roomLoadReducer(state, decision.event),
      commands: decision.commands,
    }
  } catch {
    return null
  }
}

export function advanceDoorEntryFlow(
  state: RoomLoadState,
  signal: DoorEntrySignal,
): DoorEntryFlowResult {
  const result = tryAdvanceDoorEntryFlow(state, signal)
  if (!result) {
    throw new Error(
      `Invalid door entry signal ${signal.type} while room load phase is ${state.phase}`,
    )
  }
  return result
}
