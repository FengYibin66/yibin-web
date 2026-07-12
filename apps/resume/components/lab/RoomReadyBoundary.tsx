'use client'

import {
  Component,
  Suspense,
  useEffect,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from 'react'

interface RoomReadyBoundaryProps {
  attempt: number
  onLoading: () => void
  onReady: () => void
  onError: (message: string) => void
  children: ReactNode
}

interface RoomErrorBoundaryProps {
  resetKey: number
  onError: (message: string) => void
  children: ReactNode
}

interface RoomErrorBoundaryState {
  hasError: boolean
}

class RoomErrorBoundary extends Component<
  RoomErrorBoundaryProps,
  RoomErrorBoundaryState
> {
  state: RoomErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RoomErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.props.onError(error.message)
  }

  componentDidUpdate(previousProps: RoomErrorBoundaryProps): void {
    if (
      previousProps.resetKey !== this.props.resetKey
      && this.state.hasError
    ) {
      this.setState({ hasError: false })
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

function RoomSuspenseFallback({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount()
  }, [onMount])

  return <group data-testid="room-suspense-fallback" />
}

function RoomReadySentinel({
  attempt,
  onReady,
}: Pick<RoomReadyBoundaryProps, 'attempt' | 'onReady'>) {
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    let firstFrame: number | null = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        onReadyRef.current()
      })
    })
    let secondFrame: number | null = null

    return () => {
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame)
        firstFrame = null
      }
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame)
        secondFrame = null
      }
    }
  }, [attempt])

  return null
}

export function RoomReadyBoundary({
  attempt,
  onLoading,
  onReady,
  onError,
  children,
}: RoomReadyBoundaryProps) {
  return (
    <RoomErrorBoundary onError={onError} resetKey={attempt}>
      <Suspense fallback={<RoomSuspenseFallback onMount={onLoading} />}>
        {children}
        <RoomReadySentinel attempt={attempt} onReady={onReady} />
      </Suspense>
    </RoomErrorBoundary>
  )
}
