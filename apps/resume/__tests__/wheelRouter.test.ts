import { describe, it, expect, vi } from 'vitest'

// ─── Pure extract of WheelRouter logic ───────────────────────────────────────

type WheelConsumer = (e: WheelEvent) => void

function createWheelRouterLogic() {
  const consumers  = new Map<string, WheelConsumer>()
  let activeId: string | null = null
  const passiveSet = new Set<string>()

  function subscribe(id: string, fn: WheelConsumer, opts?: { passive?: boolean }): () => void {
    consumers.set(id, fn)
    if (opts?.passive === false) passiveSet.add(id)
    return () => {
      consumers.delete(id)
      passiveSet.delete(id)
    }
  }

  function activate(id: string) {
    activeId = id
  }

  function deactivate(id: string) {
    if (activeId === id) activeId = null
  }

  function dispatch(e: WheelEvent) {
    if (!activeId) return
    const fn = consumers.get(activeId)
    if (!fn) return
    if (passiveSet.has(activeId)) {
      // Simulate preventDefault — would be called in actual listener
    }
    fn(e)
  }

  return { subscribe, activate, deactivate, dispatch }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('WheelRouter logic', () => {
  it('subscribe stores a consumer and returns unsubscribe', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    const unsub = r.subscribe('corridor', fn)
    expect(typeof unsub).toBe('function')
  })

  it('after subscribe + activate, dispatch calls the consumer', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    r.subscribe('corridor', fn)
    r.activate('corridor')

    const fakeEvent = { deltaY: 100 } as WheelEvent
    r.dispatch(fakeEvent)

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith(fakeEvent)
  })

  it('dispatch does nothing when no consumer is active', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    r.subscribe('corridor', fn)
    // Not activated — dispatch should not call fn
    r.dispatch({ deltaY: 100 } as WheelEvent)
    expect(fn).not.toHaveBeenCalled()
  })

  it('deactivate stops dispatch from calling the consumer', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    r.subscribe('corridor', fn)
    r.activate('corridor')
    r.deactivate('corridor')

    r.dispatch({ deltaY: 100 } as WheelEvent)
    expect(fn).not.toHaveBeenCalled()
  })

  it('only the active consumer is called, not others', () => {
    const r = createWheelRouterLogic()
    const fnA = vi.fn()
    const fnB = vi.fn()

    r.subscribe('a', fnA)
    r.subscribe('b', fnB)

    r.activate('a')
    r.dispatch({ deltaY: 1 } as WheelEvent)
    expect(fnA).toHaveBeenCalledTimes(1)
    expect(fnB).not.toHaveBeenCalled()

    r.activate('b')
    r.dispatch({ deltaY: 2 } as WheelEvent)
    expect(fnA).toHaveBeenCalledTimes(1) // still 1
    expect(fnB).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe removes a consumer and it wont be called', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    const unsub = r.subscribe('corridor', fn)
    r.activate('corridor')
    unsub()

    r.dispatch({ deltaY: 100 } as WheelEvent)
    expect(fn).not.toHaveBeenCalled()
  })

  it('re-subscribing with the same id replaces the old consumer', () => {
    const r = createWheelRouterLogic()
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    r.subscribe('corridor', fn1)
    r.subscribe('corridor', fn2)
    r.activate('corridor')
    r.dispatch({ deltaY: 1 } as WheelEvent)

    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('deactivate only clears if id matches', () => {
    const r = createWheelRouterLogic()
    const fn = vi.fn()
    r.subscribe('corridor', fn)
    r.activate('corridor')
    // deactivate a different id — should not clear
    r.deactivate('gallery')
    r.dispatch({ deltaY: 100 } as WheelEvent)
    expect(fn).toHaveBeenCalledOnce() // still active
  })

  it('full flow: corridor → enter room → exit room → corridor', () => {
    const r = createWheelRouterLogic()
    const corridorFn = vi.fn()
    const roomFn = vi.fn()

    r.subscribe('corridor', corridorFn, { passive: false })
    r.subscribe('room:publications', roomFn)

    // 1. Corridor scrolling
    r.activate('corridor')
    r.dispatch({ deltaY: 10 } as WheelEvent)
    expect(corridorFn).toHaveBeenCalledTimes(1)
    expect(roomFn).not.toHaveBeenCalled()

    // 2. Enter room — deactivate corridor, activate room
    r.deactivate('corridor')
    r.activate('room:publications')
    r.dispatch({ deltaY: 5 } as WheelEvent)
    expect(corridorFn).toHaveBeenCalledTimes(1) // no change
    expect(roomFn).toHaveBeenCalledTimes(1)

    // 3. Exit room — reverse
    r.deactivate('room:publications')
    r.activate('corridor')
    r.dispatch({ deltaY: 20 } as WheelEvent)
    expect(corridorFn).toHaveBeenCalledTimes(2)
    expect(roomFn).toHaveBeenCalledTimes(1)
  })

  it('Gallery flow: corridor → gallery → corridor', () => {
    const r = createWheelRouterLogic()
    const corridorFn = vi.fn()
    r.subscribe('corridor', corridorFn)
    r.activate('corridor')

    // Enter gallery
    r.activate('room:gallery')
    r.deactivate('corridor')
    r.dispatch({ deltaY: 100 } as WheelEvent)
    expect(corridorFn).not.toHaveBeenCalled() // corridor paused

    // Exit gallery — restore corridor
    r.activate('corridor')
    r.deactivate('room:gallery')
    r.dispatch({ deltaY: 50 } as WheelEvent)
    expect(corridorFn).toHaveBeenCalledOnce()
  })
})
