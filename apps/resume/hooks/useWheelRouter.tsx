'use client'

import { useEffect, useRef, useCallback, createContext, useContext } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type WheelConsumer = (e: WheelEvent) => void

interface WheelRouterAPI {
  /** Register a consumer callback. Returns an unsubscribe function. */
  subscribe: (id: string, fn: WheelConsumer, opts?: { passive?: boolean }) => () => void
  /** Make the given consumer active (wheel events route to it). */
  activate: (id: string) => void
  /** Deactivate the consumer (events stop flowing to it). */
  deactivate: (id: string) => void
}

// ─── Context ────────────────────────────────────────────────────────────────

const WheelRouterCtx = createContext<WheelRouterAPI | null>(null)

export function useWheelRouter(): WheelRouterAPI {
  const ctx = useContext(WheelRouterCtx)
  if (!ctx) throw new Error('useWheelRouter must be used within a WheelRouterProvider')
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WheelRouterProvider({ children }: { children: React.ReactNode }) {
  const consumersRef   = useRef<Map<string, WheelConsumer>>(new Map())
  const activeIdRef    = useRef<string | null>(null)
  const passiveSetRef  = useRef<Set<string>>(new Set())

  const subscribe = useCallback((id: string, fn: WheelConsumer, opts?: { passive?: boolean }): () => void => {
    consumersRef.current.set(id, fn)
    if (opts?.passive === false) passiveSetRef.current.add(id)
    return () => {
      consumersRef.current.delete(id)
      passiveSetRef.current.delete(id)
    }
  }, [])

  const activate = useCallback((id: string) => {
    activeIdRef.current = id
  }, [])

  const deactivate = useCallback((id: string) => {
    if (activeIdRef.current === id) activeIdRef.current = null
  }, [])

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const activeId = activeIdRef.current
      if (!activeId) return

      const fn = consumersRef.current.get(activeId)
      if (!fn) return

      // Corridor is the only consumer that needs preventDefault.
      // Gallery and rooms should NOT preventDefault — GSAP ScrollTrigger
      // and browser scroll need the default wheel behaviour.
      if (passiveSetRef.current.has(activeId)) {
        e.preventDefault()
      }
      fn(e)
    }

    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  const api: WheelRouterAPI = { subscribe, activate, deactivate }

  return (
    <WheelRouterCtx.Provider value={api}>
      {children}
    </WheelRouterCtx.Provider>
  )
}
