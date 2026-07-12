'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { LabLoader } from './LabLoader'

// No `loading` fallback here on purpose: LabLoader is rendered persistently
// below so it covers BOTH the JS-chunk download AND the texture loading phase.
// It exits by itself (paper-tear animation) once useProgress reaches 100%.
const LabScene = dynamic(
  () => import('./LabScene').then(m => ({ default: m.LabScene })),
  { ssr: false }
)

function webglSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    )
  } catch {
    return false
  }
}

function WebglFallback() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#f5f0e8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: "'CabinSketch', serif", fontSize: 28, color: '#2a1f0e', margin: 0 }}>
        The Lab needs WebGL
      </h1>
      <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: 'rgba(42,31,14,0.6)', maxWidth: 420, margin: 0 }}>
        Your browser or device doesn&apos;t support 3D rendering.
        The classic version has all the same content.
      </p>
      <a
        href="/classic"
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 14,
          color: '#2a1f0e',
          border: '2px solid #2a1f0e',
          borderRadius: 8,
          padding: '10px 24px',
          textDecoration: 'none',
          letterSpacing: '0.1em',
        }}
      >
        Open Classic View →
      </a>
    </div>
  )
}

export function LabClient() {
  // null = not yet checked (SSR / first paint) — render normally to avoid a flash
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setSupported(webglSupported())
  }, [])

  if (supported === false) return <WebglFallback />

  return (
    <>
      <LabScene />
      <LabLoader />
    </>
  )
}
