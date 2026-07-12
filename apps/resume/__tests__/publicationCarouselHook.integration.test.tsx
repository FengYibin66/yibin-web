import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WheelRouterProvider } from '@/hooks/useWheelRouter'
import { usePublicationCarousel } from '@/components/rooms/publications/usePublicationCarousel'

const mocks = vi.hoisted(() => ({
  canvas: undefined as HTMLCanvasElement | undefined,
  frameCallback: undefined as
    | ((state: unknown, delta: number) => void)
    | undefined,
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    mocks.frameCallback = callback
  },
  useThree: (
    selector: (state: { gl: { domElement: HTMLCanvasElement } }) => unknown,
  ) => selector({
    gl: { domElement: mocks.canvas! },
  }),
}))

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(),
  },
}))

const DEFAULT_OPTIONS = {
  active: true,
  locked: false,
  itemCount: 4,
  itemGap: 2.5,
}

function RouterWrapper({ children }: { children: ReactNode }) {
  return <WheelRouterProvider>{children}</WheelRouterProvider>
}

beforeEach(() => {
  mocks.canvas = document.createElement('canvas')
  mocks.frameCallback = undefined
})

describe('usePublicationCarousel with real WheelRouter', () => {
  it('receives window wheel only while it owns the active route', () => {
    const { result, rerender } = renderHook(
      (options: typeof DEFAULT_OPTIONS) =>
        usePublicationCarousel(options),
      {
        initialProps: DEFAULT_OPTIONS,
        wrapper: RouterWrapper,
      },
    )

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
      mocks.frameCallback?.({}, 100)
    })
    expect(result.current.currentScroll.current).toBeCloseTo(0.5)

    rerender({ ...DEFAULT_OPTIONS, locked: true })
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
      mocks.frameCallback?.({}, 100)
    })
    expect(result.current.currentScroll.current).toBeCloseTo(0.5)
  })
})
