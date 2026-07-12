import { describe, expect, it } from 'vitest'

import {
  advanceDoorEntryFlow,
  tryAdvanceDoorEntryFlow,
  type DoorEntryCommand,
} from '@/lib/lab/doorEntryFlow'
import { INITIAL_ROOM_LOAD_STATE } from '@/lib/lab/roomLoadMachine'

function expectCommands(
  commands: DoorEntryCommand[],
  expected: DoorEntryCommand[],
): void {
  expect(commands).toEqual(expected)
}

const CLICK_PUBLICATIONS = {
  type: 'CLICK' as const,
  roomId: 'publications' as const,
  segmentIndex: 0,
}

describe('door entry flow controller', () => {
  it('begins alignment after a corridor door click', () => {
    const result = advanceDoorEntryFlow(INITIAL_ROOM_LOAD_STATE, CLICK_PUBLICATIONS)

    expect(result.state.phase).toBe('aligning')
    expect(result.state.segmentIndex).toBe(0)
    expectCommands(result.commands, ['ALIGN_CAMERA'])
  })

  it('ignores duplicate clicks while an entry is already in progress', () => {
    const aligning = advanceDoorEntryFlow(INITIAL_ROOM_LOAD_STATE, CLICK_PUBLICATIONS).state

    expect(
      tryAdvanceDoorEntryFlow(aligning, {
        type: 'CLICK',
        roomId: 'publications',
        segmentIndex: 1,
      }),
    ).toBeNull()
  })

  it('mounts the room after real camera alignment while keeping the door closed', () => {
    const aligning = advanceDoorEntryFlow(INITIAL_ROOM_LOAD_STATE, CLICK_PUBLICATIONS).state
    const result = advanceDoorEntryFlow(aligning, { type: 'CAMERA_ALIGNED' })

    expect(result.state.phase).toBe('loading')
    expectCommands(result.commands, ['MOUNT_ROOM', 'START_TIMEOUT'])
    expect(result.commands).not.toContain('OPEN_DOOR')
  })

  it('opens the door only after readiness is observed', () => {
    const aligning = advanceDoorEntryFlow(INITIAL_ROOM_LOAD_STATE, CLICK_PUBLICATIONS).state
    const loading = advanceDoorEntryFlow(aligning, {
      type: 'CAMERA_ALIGNED',
    }).state
    const ready = advanceDoorEntryFlow(loading, { type: 'ROOM_READY' })

    expect(ready.state.phase).toBe('ready')
    expect(ready.commands).not.toContain('OPEN_DOOR')

    const opening = advanceDoorEntryFlow(ready.state, {
      type: 'READY_OBSERVED',
    })
    expect(opening.state.phase).toBe('opening')
    expectCommands(opening.commands, ['OPEN_DOOR'])
  })

  it('fails on timeout without opening the door', () => {
    const aligning = advanceDoorEntryFlow(INITIAL_ROOM_LOAD_STATE, CLICK_PUBLICATIONS).state
    const loading = advanceDoorEntryFlow(aligning, {
      type: 'CAMERA_ALIGNED',
    }).state
    const result = advanceDoorEntryFlow(loading, {
      type: 'TIMEOUT',
      message: 'Room loading timed out',
    })

    expect(result.state.phase).toBe('failed')
    expect(result.state.error).toBe('Room loading timed out')
    expect(result.commands).not.toContain('OPEN_DOOR')
  })

  it('increments the attempt and remounts the room on retry', () => {
    const failed = {
      phase: 'failed' as const,
      roomId: 'publications' as const,
      segmentIndex: 0,
      attempt: 2,
      error: 'Room loading timed out',
    }
    const result = advanceDoorEntryFlow(failed, { type: 'RETRY' })

    expect(result.state.attempt).toBe(3)
    expect(result.state.phase).toBe('loading')
    expectCommands(result.commands, ['MOUNT_ROOM', 'START_TIMEOUT'])
  })

  it('fully restores corridor resources when backing out of failure', () => {
    const failed = {
      phase: 'failed' as const,
      roomId: 'publications' as const,
      segmentIndex: 0,
      attempt: 1,
      error: 'Room loading timed out',
    }
    const result = advanceDoorEntryFlow(failed, { type: 'BACK' })

    expect(result.state).toEqual(INITIAL_ROOM_LOAD_STATE)
    expectCommands(result.commands, [
      'CLEAR_TIMEOUT',
      'RESTORE_CAMERA',
      'CLOSE_DOOR',
      'RESET_LOCAL_STATE',
      'RELEASE_CAMERA_OVERRIDE',
    ])
  })

  it('uses exiting before reset for a completed room visit', () => {
    const entered = {
      phase: 'entered' as const,
      roomId: 'publications' as const,
      segmentIndex: 0,
      attempt: 1,
      error: null,
    }
    const exiting = advanceDoorEntryFlow(entered, { type: 'EXIT' })

    expect(exiting.state.phase).toBe('exiting')
    expectCommands(exiting.commands, ['ANIMATE_EXIT'])

    const idle = advanceDoorEntryFlow(exiting.state, {
      type: 'EXIT_COMPLETED',
    })
    expect(idle.state).toEqual(INITIAL_ROOM_LOAD_STATE)
  })
})
