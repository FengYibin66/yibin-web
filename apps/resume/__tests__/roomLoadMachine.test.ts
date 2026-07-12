import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SceneProvider, useScene } from '@/context/SceneContext'
import {
  INITIAL_ROOM_LOAD_STATE,
  isDoorEntryOwner,
  roomLoadReducer,
  type RoomLoadEvent,
  type RoomLoadPhase,
  type RoomLoadState,
} from '@/lib/lab/roomLoadMachine'

const PUBLICATIONS_LOADING_STATE: RoomLoadState = {
  phase: 'loading',
  roomId: 'publications',
  segmentIndex: 0,
  attempt: 1,
  error: null,
}

const ROOM_LOAD_PHASES: RoomLoadPhase[] = [
  'idle',
  'aligning',
  'loading',
  'ready',
  'opening',
  'entered',
  'failed',
  'exiting',
]

const ROOM_LOAD_EVENTS: RoomLoadEvent[] = [
  { type: 'BEGIN', roomId: 'publications', segmentIndex: 0 },
  { type: 'ALIGNED' },
  { type: 'READY' },
  { type: 'OPENING' },
  { type: 'OPENED' },
  { type: 'EXIT' },
  { type: 'TELEPORT_RESET' },
  { type: 'RESET' },
  { type: 'RETRY' },
  { type: 'TIMEOUT', message: 'timed out' },
  { type: 'FAIL', message: 'failed' },
]

const LEGAL_EVENT_TYPES: Record<
  RoomLoadPhase,
  readonly RoomLoadEvent['type'][]
> = {
  idle: ['BEGIN'],
  aligning: ['ALIGNED'],
  loading: ['READY', 'TIMEOUT', 'FAIL'],
  ready: ['OPENING'],
  opening: ['OPENED'],
  entered: ['EXIT', 'TELEPORT_RESET'],
  failed: ['RESET', 'RETRY'],
  exiting: ['RESET'],
}

const INVALID_TRANSITIONS = ROOM_LOAD_PHASES.flatMap(phase =>
  ROOM_LOAD_EVENTS
    .filter(event => !LEGAL_EVENT_TYPES[phase].includes(event.type))
    .map(event => [phase, event] as const),
)

function createStateForPhase(phase: RoomLoadPhase): RoomLoadState {
  return {
    phase,
    roomId: phase === 'idle' ? null : 'publications',
    segmentIndex: phase === 'idle' ? null : 0,
    attempt: phase === 'idle' ? 0 : 1,
    error: phase === 'failed' ? 'failed' : null,
  }
}

describe('roomLoadReducer', () => {
  it('starts from the exact idle state', () => {
    expect(INITIAL_ROOM_LOAD_STATE).toEqual({
      phase: 'idle',
      roomId: null,
      segmentIndex: null,
      attempt: 0,
      error: null,
    })
  })

  it('moves through the complete successful room entry flow', () => {
    const aligning = roomLoadReducer(INITIAL_ROOM_LOAD_STATE, {
      type: 'BEGIN',
      roomId: 'publications',
      segmentIndex: 2,
    })
    expect(aligning).toEqual({
      phase: 'aligning',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    const loading = roomLoadReducer(aligning, { type: 'ALIGNED' })
    expect(loading).toEqual({
      phase: 'loading',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    const ready = roomLoadReducer(loading, { type: 'READY' })
    expect(ready).toEqual({
      phase: 'ready',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    const opening = roomLoadReducer(ready, { type: 'OPENING' })
    expect(opening).toEqual({
      phase: 'opening',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    const entered = roomLoadReducer(opening, { type: 'OPENED' })
    expect(entered).toEqual({
      phase: 'entered',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    const exiting = roomLoadReducer(entered, { type: 'EXIT' })
    expect(exiting).toEqual({
      phase: 'exiting',
      roomId: 'publications',
      segmentIndex: 2,
      attempt: 1,
      error: null,
    })

    expect(roomLoadReducer(exiting, { type: 'RESET' })).toEqual(
      INITIAL_ROOM_LOAD_STATE,
    )
  })

  it.each([
    ['TIMEOUT', 'Loading timed out'],
    ['FAIL', 'Texture preload failed'],
  ] as const)('moves loading + %s to failed with its message', (type, message) => {
    expect(
      roomLoadReducer(PUBLICATIONS_LOADING_STATE, { type, message }),
    ).toEqual({
      phase: 'failed',
      roomId: 'publications',
      segmentIndex: 0,
      attempt: 1,
      error: message,
    })
  })

  it('retries a failed load while preserving its room', () => {
    const failed: RoomLoadState = {
      phase: 'failed',
      roomId: 'publications',
      segmentIndex: 0,
      attempt: 2,
      error: 'Loading timed out',
    }

    expect(roomLoadReducer(failed, { type: 'RETRY' })).toEqual({
      phase: 'loading',
      roomId: 'publications',
      segmentIndex: 0,
      attempt: 3,
      error: null,
    })
  })

  it('resets a failed load back to the corridor', () => {
    const failed: RoomLoadState = {
      phase: 'failed',
      roomId: 'publications',
      segmentIndex: 0,
      attempt: 1,
      error: 'Loading timed out',
    }

    expect(roomLoadReducer(failed, { type: 'RESET' })).toEqual(
      INITIAL_ROOM_LOAD_STATE,
    )
  })

  it.each(INVALID_TRANSITIONS)(
    'rejects every invalid transition from %s',
    (phase, event) => {
      expect(() => roomLoadReducer(createStateForPhase(phase), event)).toThrow(
        new RegExp(`invalid room load transition.*${phase}.*${event.type}`, 'i'),
      )
    },
  )

  it('identifies the owning door by room and segment', () => {
    const aligning = roomLoadReducer(INITIAL_ROOM_LOAD_STATE, {
      type: 'BEGIN',
      roomId: 'publications',
      segmentIndex: 2,
    })

    expect(isDoorEntryOwner(aligning, 'publications', 2)).toBe(true)
    expect(isDoorEntryOwner(aligning, 'publications', 0)).toBe(false)
    expect(isDoorEntryOwner(aligning, 'projects', 2)).toBe(false)
  })
})

function SceneWrapper({ children }: { children: ReactNode }) {
  return createElement(SceneProvider, null, children)
}

describe('SceneContext room loading', () => {
  it.each(['loading', 'opening'] as const)(
    'blocks teleporting while the room is %s',
    (blockedPhase) => {
      const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })
      const teleportFromIdle = result.current.teleportTo

      act(() => result.current.beginRoomLoad('publications'))
      act(() => result.current.markRoomAligned())
      if (blockedPhase === 'opening') {
        act(() => result.current.markRoomReady())
        act(() => result.current.markRoomOpening())
      }

      act(() => teleportFromIdle('projects'))

      expect(result.current.roomLoadState.phase).toBe(blockedPhase)
      expect(result.current.currentRoom).toBeNull()
      expect(result.current.teleportTarget).toBeNull()
      expect(result.current.isTeleporting).toBe(false)
      expect(result.current.teleportPhase).toBeNull()
      expect(result.current.pendingDoorClick).toBeNull()
      expect(result.current.isFastTeleport).toBe(false)
    },
  )

  it.each(['idle', 'entered'] as const)(
    'allows existing teleport behavior while the room state is %s',
    (allowedPhase) => {
      const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

      if (allowedPhase === 'entered') {
        act(() => result.current.beginRoomLoad('publications'))
        act(() => result.current.markRoomAligned())
        act(() => result.current.markRoomReady())
        act(() => result.current.markRoomOpening())
        act(() => result.current.markRoomEntered())
        act(() => result.current.enterRoom('publications'))
      }

      act(() => result.current.teleportTo('projects'))

      expect(result.current.currentRoom).toBe(
        allowedPhase === 'entered' ? 'publications' : null,
      )
      expect(result.current.teleportTarget).toBe('projects')
      expect(result.current.isTeleporting).toBe(true)
      expect(result.current.teleportPhase).toBe('closing')
      expect(result.current.isFastTeleport).toBe(true)
    },
  )

  it('blocks a stale exit callback after teleport starts from entered', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    act(() => result.current.beginRoomLoad('publications'))
    act(() => result.current.markRoomAligned())
    act(() => result.current.markRoomReady())
    act(() => result.current.markRoomOpening())
    act(() => result.current.markRoomEntered())
    act(() => result.current.enterRoom('publications'))
    const requestExitBeforeTeleport = result.current.requestExit

    act(() => result.current.teleportTo('projects'))
    act(() => requestExitBeforeTeleport())

    expect(result.current.isTeleporting).toBe(true)
    expect(result.current.teleportPhase).toBe('closing')
    expect(result.current.roomLoadState.phase).toBe('entered')
    expect(result.current.exitRequested).toBe(false)
    expect(result.current.currentRoom).toBe('publications')

    act(() => result.current.startTeleportTransition())
    act(() => result.current.resetRoomLoadForTeleport())
    expect(result.current.roomLoadState).toEqual(INITIAL_ROOM_LOAD_STATE)
  })

  it('drives room loading through reducer-backed context actions', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    expect(result.current.roomLoadState).toEqual(INITIAL_ROOM_LOAD_STATE)
    expect(result.current.isRoomLoading).toBe(false)

    act(() => {
      expect(result.current.dispatchDoorEntry({
        type: 'CLICK',
        roomId: 'publications',
        segmentIndex: 0,
      })).not.toBeNull()
      expect(result.current.dispatchDoorEntry({
        type: 'CLICK',
        roomId: 'publications',
        segmentIndex: 1,
      })).toBeNull()
    })
    expect(result.current.roomLoadState.phase).toBe('aligning')
    expect(result.current.isRoomLoading).toBe(true)

    act(() => result.current.markRoomAligned())
    expect(result.current.roomLoadState.phase).toBe('loading')
    expect(result.current.isRoomLoading).toBe(true)

    act(() => result.current.markRoomReady())
    expect(result.current.roomLoadState.phase).toBe('ready')
    expect(result.current.isRoomLoading).toBe(false)

    act(() => result.current.markRoomOpening())
    expect(result.current.roomLoadState.phase).toBe('opening')

    act(() => result.current.markRoomEntered())
    expect(result.current.roomLoadState.phase).toBe('entered')

    act(() => result.current.requestExit())
    expect(result.current.roomLoadState.phase).toBe('exiting')
    expect(result.current.exitRequested).toBe(true)

    act(() => result.current.resetRoomLoad())
    expect(result.current.roomLoadState).toEqual(INITIAL_ROOM_LOAD_STATE)
  })

  it('exposes failure recovery actions without duplicating loading state', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    act(() => result.current.beginRoomLoad('publications'))
    act(() => result.current.markRoomAligned())
    act(() => result.current.failRoomLoad('Texture preload failed'))

    expect(result.current.roomLoadState).toMatchObject({
      phase: 'failed',
      error: 'Texture preload failed',
    })
    expect(result.current.isRoomLoading).toBe(false)

    act(() => result.current.retryRoomLoad())
    expect(result.current.roomLoadState).toMatchObject({
      phase: 'loading',
      roomId: 'publications',
      attempt: 2,
      error: null,
    })

    act(() => result.current.failRoomLoad('Loading timed out'))
    act(() => result.current.resetRoomLoad())
    expect(result.current.roomLoadState).toEqual(INITIAL_ROOM_LOAD_STATE)
  })

  it('preserves timeout semantics through the scene action', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    act(() => result.current.beginRoomLoad('publications'))
    act(() => result.current.markRoomAligned())
    act(() => result.current.timeoutRoomLoad('Room loading timed out'))

    expect(result.current.roomLoadState).toMatchObject({
      phase: 'failed',
      error: 'Room loading timed out',
    })
  })
})
