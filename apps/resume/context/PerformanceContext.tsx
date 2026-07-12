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

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  // maxTouchPoints catches iPads that report a desktop UA
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints ?? 0) > 2
}

function detectInitialTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'MEDIUM'
  // Phones/tablets always start LOW — hardwareConcurrency alone misclassifies
  // them (modern iPhones report 6+ cores) and mobile GPUs/thermals can't
  // sustain desktop settings. Stability beats fidelity on first load.
  if (isMobileDevice()) return 'LOW'
  const cores = navigator.hardwareConcurrency ?? 4
  if (cores <= 4) return 'LOW'
  if (cores >= 8) return 'HIGH'
  return 'MEDIUM'
}

function tierToSettings(tier: PerformanceTier): PerformanceState['settings'] {
  // Never render more device pixels than the screen actually has
  const deviceDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 2
  switch (tier) {
    case 'HIGH':
      return { antialias: true, dpr: Math.min(2, deviceDpr), shadows: true }
    case 'MEDIUM':
      return { antialias: true, dpr: Math.min(1.5, deviceDpr), shadows: false }
    case 'LOW':
      // 1.25 keeps sketch-style textures legible on 3x phone screens
      // while staying far below the cost of native DPR rendering.
      return { antialias: false, dpr: Math.min(1.25, deviceDpr), shadows: false }
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
