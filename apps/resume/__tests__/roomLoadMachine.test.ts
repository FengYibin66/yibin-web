import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SceneProvider, useScene } from '@/context/SceneContext'
import {
  INITIAL_ROOM_LOAD_STATE,
  roomLoadReducer,
  type RoomLoadEvent,
  type RoomLoadPhase,
  type RoomLoadState,
} from '@/lib/lab/roomLoadMachine'

const PUBLICATIONS_LOADING_STATE: RoomLoadState = {
  phase: 'loading',
  roomId: 'publications',
  attempt: 1,
  error: null,
}

describe('roomLoadReducer', () => {
  it('starts from the exact idle state', () => {
    expect(INITIAL_ROOM_LOAD_STATE).toEqual({
      phase: 'idle',
      roomId: null,
      attempt: 0,
      error: null,
    })
  })

  it('moves through the complete successful room entry flow', () => {
    const aligning = roomLoadReducer(INITIAL_ROOM_LOAD_STATE, {
      type: 'BEGIN',
      roomId: 'publications',
    })
    expect(aligning).toEqual({
      phase: 'aligning',
      roomId: 'publications',
      attempt: 1,
      error: null,
    })

    const loading = roomLoadReducer(aligning, { type: 'ALIGNED' })
    expect(loading.phase).toBe('loading')

    const ready = roomLoadReducer(loading, { type: 'READY' })
    expect(ready.phase).toBe('ready')

    const opening = roomLoadReducer(ready, { type: 'OPENING' })
    expect(opening.phase).toBe('opening')

    const entered = roomLoadReducer(opening, { type: 'OPENED' })
    expect(entered.phase).toBe('entered')

    const exiting = roomLoadReducer(entered, { type: 'EXIT' })
    expect(exiting.phase).toBe('exiting')

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
      attempt: 1,
      error: message,
    })
  })

  it('retries a failed load while preserving its room', () => {
    const failed: RoomLoadState = {
      phase: 'failed',
      roomId: 'publications',
      attempt: 2,
      error: 'Loading timed out',
    }

    expect(roomLoadReducer(failed, { type: 'RETRY' })).toEqual({
      phase: 'loading',
      roomId: 'publications',
      attempt: 3,
      error: null,
    })
  })

  it('resets a failed load back to the corridor', () => {
    const failed: RoomLoadState = {
      phase: 'failed',
      roomId: 'publications',
      attempt: 1,
      error: 'Loading timed out',
    }

    expect(roomLoadReducer(failed, { type: 'RESET' })).toEqual(
      INITIAL_ROOM_LOAD_STATE,
    )
  })

  it.each<[RoomLoadPhase, RoomLoadEvent]>([
    ['idle', { type: 'RESET' }],
    ['aligning', { type: 'READY' }],
    ['loading', { type: 'OPENED' }],
    ['ready', { type: 'RESET' }],
    ['opening', { type: 'EXIT' }],
    ['entered', { type: 'BEGIN', roomId: 'gallery' }],
    ['exiting', { type: 'RETRY' }],
    ['failed', { type: 'OPENING' }],
  ])('rejects an invalid transition from %s', (phase, event) => {
    const state: RoomLoadState = {
      phase,
      roomId: phase === 'idle' ? null : 'publications',
      attempt: phase === 'idle' ? 0 : 1,
      error: phase === 'failed' ? 'failed' : null,
    }

    expect(() => roomLoadReducer(state, event)).toThrow(
      new RegExp(`invalid room load transition.*${phase}.*${event.type}`, 'i'),
    )
  })
})

function SceneWrapper({ children }: { children: ReactNode }) {
  return createElement(SceneProvider, null, children)
}

describe('SceneContext room loading', () => {
  it('drives room loading through reducer-backed context actions', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    expect(result.current.roomLoadState).toEqual(INITIAL_ROOM_LOAD_STATE)
    expect(result.current.isRoomLoading).toBe(false)

    act(() => result.current.beginRoomLoad('publications'))
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
