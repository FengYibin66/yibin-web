'use client'

import { createContext, useContext, useState, useMemo, useCallback } from 'react'

export type PerformanceTier = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PerformanceState {
  tier: PerformanceTier
  downgradeTier: () => void
  settings: {
    antialias: boolean
    dpr: number
    shadows: boolean
  }
}

function detectInitialTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'MEDIUM'
  const cores = navigator.hardwareConcurrency ?? 4
  if (cores <= 4) return 'LOW'
  if (cores >= 8) return 'HIGH'
  return 'MEDIUM'
}

function tierToSettings(tier: PerformanceTier): PerformanceState['settings'] {
  switch (tier) {
    case 'HIGH':
      return { antialias: true, dpr: 2, shadows: true }
    case 'MEDIUM':
      return { antialias: true, dpr: 1.5, shadows: false }
    case 'LOW':
      return { antialias: false, dpr: 1, shadows: false }
  }
}

const PerformanceCtx = createContext<PerformanceState | null>(null)

export function usePerformance(): PerformanceState {
  const context = useContext(PerformanceCtx)
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider')
  }
  return context
}

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<PerformanceTier>(detectInitialTier)

  const downgradeTier = useCallback(() => {
    setTier(prev => {
      if (prev === 'HIGH') return 'MEDIUM'
      if (prev === 'MEDIUM') return 'LOW'
      return 'LOW'
    })
  }, [])

  const value = useMemo<PerformanceState>(() => ({
    tier,
    downgradeTier,
    settings: tierToSettings(tier),
  }), [tier, downgradeTier])

  return (
    <PerformanceCtx.Provider value={value}>
      {children}
    </PerformanceCtx.Provider>
  )
}
