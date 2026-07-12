import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDoorEntryOrchestrator } from '@/components/lab/useDoorEntryOrchestrator'
import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

const READY_STATE: RoomLoadState = {
  phase: 'ready',
  roomId: 'publications',
  segmentIndex: 0,
  attempt: 1,
  error: null,
}

const LOADING_STATE: RoomLoadState = {
  ...READY_STATE,
  phase: 'loading',
}

interface HarnessProps {
  isEntryOwner: boolean
  state: RoomLoadState
  markRoomOpening: () => void
  timeoutRoomLoad: (message: string) => void
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  onFailureReset: () => void
}

function OrchestratorHarness(props: HarnessProps) {
  useDoorEntryOrchestrator({
    roomId: 'publications',
    segmentIndex: 0,
    roomLoadState: props.state,
    isEntryOwner: props.isEntryOwner,
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
  isEntryOwner: boolean,
  state: RoomLoadState,
): HarnessProps {
  return {
    isEntryOwner,
    state,
    markRoomOpening: vi.fn(),
    timeoutRoomLoad: vi.fn(),
    openDoorPanels: vi.fn(),
    onFailureReset: vi.fn(),
  }
}

describe('useDoorEntryOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lets only the active duplicate open once when ready', () => {
    const active = createHarnessProps(true, READY_STATE)
    const inactive = createHarnessProps(false, READY_STATE)

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
    const active = createHarnessProps(true, LOADING_STATE)
    const inactive = createHarnessProps(false, LOADING_STATE)

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
    const failed: RoomLoadState = {
      ...LOADING_STATE,
      phase: 'failed',
      error: 'Room loading timed out',
    }
    const props = createHarnessProps(true, failed)
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
    const active = createHarnessProps(true, {
      ...LOADING_STATE,
      phase: 'failed',
      error: 'Room loading timed out',
    })
    const inactive = createHarnessProps(false, {
      ...LOADING_STATE,
      phase: 'failed',
      error: 'Room loading timed out',
    })
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
          state={{ phase: 'idle', roomId: null, segmentIndex: null, attempt: 0, error: null }}
        />
        <OrchestratorHarness
          {...inactive}
          state={{ phase: 'idle', roomId: null, segmentIndex: null, attempt: 0, error: null }}
        />
      </>,
    )

    expect(active.onFailureReset).toHaveBeenCalledTimes(1)
    expect(inactive.onFailureReset).not.toHaveBeenCalled()
  })
})
