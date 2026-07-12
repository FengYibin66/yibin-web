import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('RoomReadyBoundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
})
