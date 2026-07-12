import type { RefObject } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDoorEntryOrchestrator } from '@/components/lab/useDoorEntryOrchestrator'
import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

const READY_STATE: RoomLoadState = {
  phase: 'ready',
  roomId: 'publications',
  attempt: 1,
  error: null,
}

const LOADING_STATE: RoomLoadState = {
  ...READY_STATE,
  phase: 'loading',
}

interface HarnessProps {
  activeEntryRef: RefObject<boolean>
  state: RoomLoadState
  markRoomOpening: () => void
  timeoutRoomLoad: (message: string) => void
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  onFailureReset: () => void
}

function OrchestratorHarness(props: HarnessProps) {
  useDoorEntryOrchestrator({
    roomId: 'publications',
    roomLoadState: props.state,
    activeEntryRef: props.activeEntryRef,
    isFastTeleport: false,
    markRoomOpening: props.markRoomOpening,
    timeoutRoomLoad: props.timeoutRoomLoad,
    openDoorPanels: props.openDoorPanels,
    flyIntoRoom: vi.fn(),
    onFailureReset: props.onFailureReset,
  })
  return null
}

function createHarnessProps(
  activeEntryRef: RefObject<boolean>,
  state: RoomLoadState,
): HarnessProps {
  return {
    activeEntryRef,
    state,
    markRoomOpening: vi.fn(),
    timeoutRoomLoad: vi.fn(),
    openDoorPanels: vi.fn(),
    onFailureReset: vi.fn(),
  }
}

function createActiveRef(current: boolean): RefObject<boolean> {
  return { current }
}

describe('useDoorEntryOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lets only the active duplicate open once when ready', () => {
    const activeRef = createActiveRef(true)
    const inactiveRef = createActiveRef(false)
    const active = createHarnessProps(activeRef, READY_STATE)
    const inactive = createHarnessProps(inactiveRef, READY_STATE)

    const view = render(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )
    view.rerender(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )

    expect(active.markRoomOpening).toHaveBeenCalledTimes(1)
    expect(active.openDoorPanels).toHaveBeenCalledTimes(1)
    expect(inactive.markRoomOpening).not.toHaveBeenCalled()
    expect(inactive.openDoorPanels).not.toHaveBeenCalled()
  })

  it('times out only the active duplicate without opening either door', () => {
    const activeRef = createActiveRef(true)
    const inactiveRef = createActiveRef(false)
    const active = createHarnessProps(activeRef, LOADING_STATE)
    const inactive = createHarnessProps(inactiveRef, LOADING_STATE)

    render(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )
    act(() => {
      vi.advanceTimersByTime(8000)
    })

    expect(active.timeoutRoomLoad).toHaveBeenCalledWith('Room loading timed out')
    expect(inactive.timeoutRoomLoad).not.toHaveBeenCalled()
    expect(active.openDoorPanels).not.toHaveBeenCalled()
    expect(inactive.openDoorPanels).not.toHaveBeenCalled()
  })

  it('restarts the active timeout after retry', () => {
    const activeRef = createActiveRef(true)
    const failed: RoomLoadState = {
      ...LOADING_STATE,
      phase: 'failed',
      error: 'Room loading timed out',
    }
    const props = createHarnessProps(activeRef, failed)
    const view = render(<OrchestratorHarness {...props} />)

    view.rerender(
      <OrchestratorHarness
        {...props}
        state={{ ...LOADING_STATE, attempt: 2 }}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(8000)
    })

    expect(props.timeoutRoomLoad).toHaveBeenCalledTimes(1)
  })

  it('runs failed-to-idle cleanup only for the active duplicate', () => {
    const activeRef = createActiveRef(true)
    const inactiveRef = createActiveRef(false)
    const failed: RoomLoadState = {
      ...LOADING_STATE,
      phase: 'failed',
      error: 'Room loading timed out',
    }
    const active = createHarnessProps(activeRef, failed)
    const inactive = createHarnessProps(inactiveRef, failed)
    const view = render(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )

    view.rerender(
      <>
        <OrchestratorHarness
          {...active}
          state={{ ...failed, phase: 'idle', roomId: null, attempt: 0, error: null }}
        />
        <OrchestratorHarness
          {...inactive}
          state={{ ...failed, phase: 'idle', roomId: null, attempt: 0, error: null }}
        />
      </>,
    )

    expect(active.onFailureReset).toHaveBeenCalledTimes(1)
    expect(inactive.onFailureReset).not.toHaveBeenCalled()
  })
})
