import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicationCarousel } from '@/components/rooms/publications/usePublicationCarousel'

interface TweenVars {
  current: number
  onComplete: () => void
  onInterrupt?: () => void
}

interface TweenCall {
  target: React.MutableRefObject<number>
  vars: TweenVars
  tween: { kill: ReturnType<typeof vi.fn> }
}

const mocks = vi.hoisted(() => {
  const router = {
    subscribe: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  }

  return {
    router,
    frameCallback: undefined as
      | ((state: unknown, delta: number) => void)
      | undefined,
    wheelHandler: undefined as ((event: WheelEvent) => void) | undefined,
    canvas: undefined as HTMLCanvasElement | undefined,
    unsubscribe: vi.fn(),
    tweenCalls: [] as TweenCall[],
    gsapTo: vi.fn(),
  }
})

vi.mock('@/hooks/useWheelRouter', () => ({
  useWheelRouter: () => mocks.router,
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
    to: mocks.gsapTo,
  },
}))

const DEFAULT_OPTIONS = {
  active: true,
  locked: false,
  itemCount: 4,
  itemGap: 2.5,
}

function runFrame(delta: number): void {
  act(() => {
    mocks.frameCallback?.({}, delta)
  })
}

function dispatchPointer(
  target: EventTarget,
  type: string,
  init: {
    pointerId?: number
    pointerType?: string
    isPrimary?: boolean
    clientX?: number
    clientY?: number
    button?: number
  } = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? 'touch' },
    isPrimary: { value: init.isPrimary ?? true },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    button: { value: init.button ?? 0 },
  })
  target.dispatchEvent(event)
  return event
}

function createPointerTarget(): HTMLCanvasElement {
  const target = document.createElement('canvas')
  Object.defineProperties(target, {
    setPointerCapture: { value: vi.fn() },
    releasePointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn(() => true) },
  })
  document.body.append(target)
  return target
}

function completeTween(call: TweenCall): void {
  act(() => {
    call.target.current = call.vars.current
    call.vars.onComplete()
  })
}

beforeEach(() => {
  mocks.frameCallback = undefined
  mocks.wheelHandler = undefined
  mocks.tweenCalls.length = 0
  mocks.unsubscribe.mockReset()
  mocks.router.subscribe.mockReset()
  mocks.router.activate.mockReset()
  mocks.router.deactivate.mockReset()
  mocks.gsapTo.mockReset()
  mocks.canvas = createPointerTarget()

  mocks.router.subscribe.mockImplementation(
    (_id: string, handler: (event: WheelEvent) => void) => {
      mocks.wheelHandler = handler
      return mocks.unsubscribe
    },
  )
  mocks.gsapTo.mockImplementation(
    (target: React.MutableRefObject<number>, vars: TweenVars) => {
      const tween = { kill: vi.fn() }
      mocks.tweenCalls.push({ target, vars, tween })
      return tween
    },
  )
})

describe('usePublicationCarousel wheel routing', () => {
  it('continues handling wheel, pointer, and frames after StrictMode remount', () => {
    const { result } = renderHook(
      () => usePublicationCarousel(DEFAULT_OPTIONS),
      { wrapper: StrictMode },
    )
    const target = mocks.canvas!

    act(() => {
      mocks.wheelHandler?.({ deltaY: 100 } as WheelEvent)
    })
    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    dispatchPointer(target, 'pointermove', { clientX: 80, clientY: 100 })
    runFrame(100)

    expect(result.current.currentScroll.current).toBeCloseTo(0.66)
  })

  it('consumes wheel only while active and unlocked without preventing default', () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    const preventDefault = vi.fn()

    act(() => {
      mocks.wheelHandler?.({ deltaY: 100, preventDefault } as unknown as WheelEvent)
    })
    runFrame(0.2)

    expect(mocks.router.subscribe).toHaveBeenCalledWith(
      'room:publications',
      expect.any(Function),
    )
    expect(mocks.router.activate).toHaveBeenCalledWith('room:publications')
    expect(result.current.currentScroll.current).toBeCloseTo(
      0.5 * (1 - Math.exp(-1)),
    )
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it.each([
    { active: false, locked: false },
    { active: true, locked: true },
  ])('does not consume wheel for disabled options %o', options => {
    const { result } = renderHook(() =>
      usePublicationCarousel({ ...DEFAULT_OPTIONS, ...options }),
    )
    const preventDefault = vi.fn()

    act(() => {
      mocks.wheelHandler?.({ deltaY: 100, preventDefault } as unknown as WheelEvent)
    })
    runFrame(1)

    expect(mocks.router.deactivate).toHaveBeenCalledWith('room:publications')
    expect(result.current.currentScroll.current).toBe(0)
    expect(preventDefault).not.toHaveBeenCalled()
  })
})

describe('usePublicationCarousel pointer input', () => {
  it('does not start a drag from an overlay outside the R3F canvas', () => {
    const overlayButton = document.createElement('button')
    document.body.append(overlayButton)
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(overlayButton, 'pointerdown', {
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(overlayButton, 'pointermove', {
      clientX: 50,
      clientY: 100,
    })
    runFrame(100)

    expect(result.current.currentScroll.current).toBe(0)
  })

  it('captures and applies a primary horizontal touch drag', () => {
    const target = mocks.canvas!
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    const move = dispatchPointer(target, 'pointermove', {
      clientX: 80,
      clientY: 102,
    })
    runFrame(1)

    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(move.defaultPrevented).toBe(true)
    expect(result.current.currentScroll.current).toBeGreaterThan(0)
  })

  it('does not update or capture for a vertical touch drag', () => {
    const target = mocks.canvas!
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    const move = dispatchPointer(target, 'pointermove', {
      clientX: 98,
      clientY: 75,
    })
    runFrame(1)

    expect(target.setPointerCapture).not.toHaveBeenCalled()
    expect(move.defaultPrevented).toBe(false)
    expect(result.current.currentScroll.current).toBe(0)
  })

  it('ignores non-primary pointers and mouse drags', () => {
    const target = mocks.canvas!
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', {
      isPrimary: false,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(target, 'pointermove', { clientX: 50, clientY: 100 })
    dispatchPointer(target, 'pointerdown', {
      pointerType: 'mouse',
      pointerId: 2,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(target, 'pointermove', {
      pointerType: 'mouse',
      pointerId: 2,
      clientX: 50,
      clientY: 100,
    })
    runFrame(1)

    expect(result.current.currentScroll.current).toBe(0)
  })

  it('clears drag state on pointercancel', () => {
    const target = mocks.canvas!
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    dispatchPointer(target, 'pointermove', { clientX: 80, clientY: 100 })
    dispatchPointer(target, 'pointercancel')
    dispatchPointer(target, 'pointermove', { clientX: 40, clientY: 100 })
    runFrame(100)

    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(result.current.currentScroll.current).toBeCloseTo(0.16)
  })

  it('clears drag state on lostpointercapture', () => {
    const target = mocks.canvas!
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    dispatchPointer(target, 'pointermove', { clientX: 80, clientY: 100 })
    dispatchPointer(target, 'lostpointercapture')
    dispatchPointer(target, 'pointermove', { clientX: 40, clientY: 100 })
    runFrame(100)

    expect(result.current.currentScroll.current).toBeCloseTo(0.16)
  })

  it('resets without consuming movement when pointer capture fails', () => {
    const target = mocks.canvas!
    vi.mocked(target.setPointerCapture).mockImplementation(() => {
      throw new DOMException('capture failed')
    })
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    const failedMove = dispatchPointer(target, 'pointermove', {
      clientX: 80,
      clientY: 100,
    })
    dispatchPointer(target, 'pointermove', { clientX: 40, clientY: 100 })
    runFrame(100)

    expect(failedMove.defaultPrevented).toBe(false)
    expect(result.current.currentScroll.current).toBe(0)
    expect(target.setPointerCapture).toHaveBeenCalledOnce()
  })

  it('stops responding after cleanup', () => {
    const target = mocks.canvas!
    const { result, unmount } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    const api = result.current

    unmount()
    dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })
    dispatchPointer(target, 'pointermove', { clientX: 50, clientY: 100 })
    mocks.wheelHandler?.({ deltaY: 100 } as WheelEvent)
    runFrame(1)

    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
    expect(api.currentScroll.current).toBe(0)
  })
})

describe('usePublicationCarousel animation', () => {
  it.each([
    { active: false, locked: false },
    { active: true, locked: true },
  ])(
    'cancels center and clears drag when interaction changes to %o',
    async disabledOptions => {
      const target = mocks.canvas!
      const { result, rerender } = renderHook(
        (options: typeof DEFAULT_OPTIONS) =>
          usePublicationCarousel(options),
        { initialProps: DEFAULT_OPTIONS },
      )
      const promise = result.current.centerItem(1)
      const call = mocks.tweenCalls[0]
      dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })

      rerender({ ...DEFAULT_OPTIONS, ...disabledOptions })
      await promise
      call.vars.onComplete()
      rerender(DEFAULT_OPTIONS)
      dispatchPointer(target, 'pointermove', { clientX: 50, clientY: 100 })
      runFrame(100)

      expect(call.tween.kill).toHaveBeenCalledOnce()
      expect(result.current.currentScroll.current).toBe(0)
    },
  )

  it.each([
    { itemCount: 5 },
    { itemGap: 3 },
  ])(
    'cancels stale center and drag when geometry changes to %o',
    async geometry => {
      const target = mocks.canvas!
      const { result, rerender } = renderHook(
        (options: typeof DEFAULT_OPTIONS) =>
          usePublicationCarousel(options),
        { initialProps: DEFAULT_OPTIONS },
      )
      const promise = result.current.centerItem(1)
      const call = mocks.tweenCalls[0]
      dispatchPointer(target, 'pointerdown', { clientX: 100, clientY: 100 })

      rerender({ ...DEFAULT_OPTIONS, ...geometry })
      await promise
      call.vars.onComplete()
      dispatchPointer(target, 'pointermove', { clientX: 50, clientY: 100 })
      runFrame(100)

      expect(call.tween.kill).toHaveBeenCalledOnce()
      expect(result.current.currentScroll.current).toBe(0)
    },
  )

  it('uses frame-rate-independent smoothing without overshoot', () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    act(() => {
      mocks.wheelHandler?.({ deltaY: 200 } as WheelEvent)
    })

    runFrame(0.2)
    expect(result.current.currentScroll.current).toBeCloseTo(1 - Math.exp(-1))

    runFrame(100)
    expect(result.current.currentScroll.current).toBeCloseTo(1)
    expect(result.current.currentScroll.current).toBeLessThanOrEqual(1)
  })

  it('centers with one target-only tween and resolves on completion', async () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    let settled = false

    const promise = result.current.centerItem(3).then(() => {
      settled = true
    })
    const call = mocks.tweenCalls[0]

    expect(mocks.gsapTo).toHaveBeenCalledOnce()
    expect(call.target).not.toBe(result.current.currentScroll)
    expect(call.vars.current).toBe(-2.5)
    expect(settled).toBe(false)

    completeTween(call)
    await promise
    expect(result.current.currentScroll.current).toBe(-2.5)
    expect(settled).toBe(true)
  })

  it('kills a replaced tween and settles its promise', async () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    const first = result.current.centerItem(1)
    const firstCall = mocks.tweenCalls[0]
    const second = result.current.centerItem(2)
    const secondCall = mocks.tweenCalls[1]

    await first
    expect(firstCall.tween.kill).toHaveBeenCalledOnce()

    completeTween(secondCall)
    await second
    expect(result.current.currentScroll.current).toBe(-5)
  })

  it('settles only once when kill also invokes onInterrupt', async () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    let settlementCount = 0
    const first = result.current.centerItem(1).then(() => {
      settlementCount += 1
    })
    const firstCall = mocks.tweenCalls[0]
    firstCall.tween.kill.mockImplementation(() => {
      firstCall.vars.onInterrupt?.()
    })

    const second = result.current.centerItem(2)
    await first
    firstCall.vars.onComplete()
    await Promise.resolve()

    expect(settlementCount).toBe(1)
    completeTween(mocks.tweenCalls[1])
    await second
  })

  it('kills an active tween and settles its promise on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )
    const promise = result.current.centerItem(1)
    const call = mocks.tweenCalls[0]

    unmount()
    await promise

    expect(call.tween.kill).toHaveBeenCalledOnce()
  })

  it('rejects invalid indexes using the carousel math contract', async () => {
    const { result } = renderHook(() =>
      usePublicationCarousel(DEFAULT_OPTIONS),
    )

    await expect(result.current.centerItem(1.5)).rejects.toBeInstanceOf(
      RangeError,
    )
    expect(mocks.gsapTo).not.toHaveBeenCalled()
  })

  it('keeps the returned API and center function stable across rerenders', () => {
    const { result, rerender } = renderHook(
      ({ locked }) =>
        usePublicationCarousel({ ...DEFAULT_OPTIONS, locked }),
      { initialProps: { locked: false } },
    )
    const firstApi = result.current

    rerender({ locked: true })

    expect(result.current).toBe(firstApi)
    expect(result.current.centerItem).toBe(firstApi.centerItem)
  })
})
