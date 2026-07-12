'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function BackButton() {
  const params = useSearchParams()
  const router = useRouter()

  const from = params.get('from')
  if (!from || (from !== 'lab' && from !== 'classic')) return null

  const isFromLab = from === 'lab'
  const label = isFromLab ? 'Back to Corridor' : 'Back to Portfolio'
  const href = isFromLab ? '/lab' : '/classic'

  return (
    <button
      onClick={() => router.push(href)}
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        zIndex: 9999,
        background: 'rgba(255,255,255,0.9)',
        border: '1.5px solid rgba(42,31,14,0.15)',
        borderRadius: 6,
        padding: '8px 14px',
        fontFamily: "'CabinSketch-Bold', serif",
        fontSize: 13,
        color: '#2a1f0e',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      aria-label={label}
    >
      ← {label}
    </button>
  )
}

export function GalleryBackButton() {
  return (
    <Suspense fallback={null}>
      <BackButton />
    </Suspense>
  )
}
