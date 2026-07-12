import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const roomRenderMock = vi.hoisted(() => vi.fn())
const sceneActionMocks = vi.hoisted(() => ({
  markRoomAligned: vi.fn(),
  markRoomReady: vi.fn(),
  failRoomLoad: vi.fn(),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    roomLoadState: { phase: 'aligning', attempt: 7 },
    ...sceneActionMocks,
  }),
}))

vi.mock('@/components/rooms/AboutRoom', () => ({
  AboutRoom: (props: unknown) => roomRenderMock(props),
}))
vi.mock('@/components/rooms/ProjectsRoom', () => ({
  ProjectsRoom: () => null,
}))
vi.mock('@/components/rooms/publications/PublicationsRoom', () => ({
  PublicationsRoom: () => null,
}))
vi.mock('@/components/rooms/ContactRoom', () => ({
  ContactRoom: () => null,
}))

import { RoomInterior } from '@/components/lab/RoomInterior'
import { RoomReadyBoundary } from '@/components/lab/RoomReadyBoundary'

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolve = () => {}
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function createSuspendingChild(deferred: Deferred) {
  let isResolved = false
  deferred.promise.then(() => {
    isResolved = true
  })

  return function SuspendingChild() {
    if (!isResolved) {
      throw deferred.promise
    }

    return <div>Room assets loaded</div>
  }
}

function ThrowingChild({ message }: { message: string }): ReactNode {
  throw new Error(message)
}

function RecoverableChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Initial room render failed')
  }

  return <div>Recovered room</div>
}

describe('RoomReadyBoundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    roomRenderMock.mockReset()
    roomRenderMock.mockReturnValue(null)
    Object.values(sceneActionMocks).forEach((action) => action.mockReset())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports loading and waits two animation frames after Suspense resolves', async () => {
    const deferred = createDeferred()
    const SuspendingChild = createSuspendingChild(deferred)
    const onLoading = vi.fn()
    const onReady = vi.fn()

    render(
      <RoomReadyBoundary
        attempt={1}
        onLoading={onLoading}
        onReady={onReady}
        onError={vi.fn()}
      >
        <SuspendingChild />
      </RoomReadyBoundary>,
    )

    expect(screen.getByTestId('room-suspense-fallback')).toBeInTheDocument()
    expect(onLoading).toHaveBeenCalledTimes(1)
    expect(onReady).not.toHaveBeenCalled()

    deferred.resolve()
    await act(async () => {})
    expect(onReady).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(onReady).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('can report ready again when attempt changes', () => {
    const onReady = vi.fn()
    const props = {
      onLoading: vi.fn(),
      onReady,
      onError: vi.fn(),
      children: <div>Room assets loaded</div>,
    }
    const { rerender } = render(
      <RoomReadyBoundary attempt={1} {...props} />,
    )

    act(() => {
      vi.advanceTimersToNextFrame()
      vi.advanceTimersToNextFrame()
    })
    expect(onReady).toHaveBeenCalledTimes(1)

    rerender(<RoomReadyBoundary attempt={2} {...props} />)
    act(() => {
      vi.advanceTimersToNextFrame()
      vi.advanceTimersToNextFrame()
    })

    expect(onReady).toHaveBeenCalledTimes(2)
  })

  it('cancels all pending animation frames when unmounted', () => {
    const onReady = vi.fn()
    const { unmount } = render(
      <RoomReadyBoundary
        attempt={1}
        onLoading={vi.fn()}
        onReady={onReady}
        onError={vi.fn()}
      >
        <div>Room assets loaded</div>
      </RoomReadyBoundary>,
    )

    act(() => {
      vi.advanceTimersToNextFrame()
    })
    unmount()
    act(() => {
      vi.advanceTimersToNextFrame()
    })

    expect(onReady).not.toHaveBeenCalled()
  })

  it('reports rendering errors with their message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()

    render(
      <RoomReadyBoundary
        attempt={1}
        onLoading={vi.fn()}
        onReady={vi.fn()}
        onError={onError}
      >
        <ThrowingChild message="Texture preload failed" />
      </RoomReadyBoundary>,
    )

    expect(onError).toHaveBeenCalledWith('Texture preload failed')
  })

  it('resets an error and reports ready after attempt changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReady = vi.fn()
    const props = {
      onLoading: vi.fn(),
      onReady,
      onError: vi.fn(),
    }
    const { rerender } = render(
      <RoomReadyBoundary attempt={1} {...props}>
        <RecoverableChild shouldThrow />
      </RoomReadyBoundary>,
    )

    expect(props.onError).toHaveBeenCalledWith('Initial room render failed')

    rerender(
      <RoomReadyBoundary attempt={2} {...props}>
        <RecoverableChild shouldThrow={false} />
      </RoomReadyBoundary>,
    )
    expect(screen.getByText('Recovered room')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersToNextFrame()
      vi.advanceTimersToNextFrame()
    })
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})

describe('RoomInterior boundary callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    roomRenderMock.mockReset()
    Object.values(sceneActionMocks).forEach((action) => action.mockReset())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('forwards Suspense loading without advancing SceneContext', () => {
    const pendingAsset = new Promise<void>(() => {})
    roomRenderMock.mockImplementation(() => {
      throw pendingAsset
    })
    const onLoading = vi.fn()

    render(
      <RoomInterior
        roomId="about"
        showRoom
        onReady={vi.fn()}
        onLoading={onLoading}
        isExiting={false}
      />,
    )

    expect(onLoading).toHaveBeenCalledTimes(1)
    expect(sceneActionMocks.markRoomAligned).not.toHaveBeenCalled()
  })

  it('keeps readiness in the boundary instead of passing it to the room', () => {
    render(
      <RoomInterior
        roomId="about"
        showRoom
        onReady={vi.fn()}
        isExiting={false}
      />,
    )

    expect(roomRenderMock).toHaveBeenCalledWith({
      showRoom: true,
      isExiting: false,
    })
  })

  it('forwards render errors without failing SceneContext directly', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    roomRenderMock.mockImplementation(() => {
      throw new Error('Room render failed')
    })
    const onError = vi.fn()

    render(
      <RoomInterior
        roomId="about"
        showRoom
        onReady={vi.fn()}
        onError={onError}
        isExiting={false}
      />,
    )

    expect(onError).toHaveBeenCalledWith('Room render failed')
    expect(sceneActionMocks.failRoomLoad).not.toHaveBeenCalled()
  })
})
