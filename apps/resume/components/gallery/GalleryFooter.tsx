'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Footer() {
  const params = useSearchParams()
  const from = params.get('from')

  const isFromClassic = from === 'classic'
  const backHref = isFromClassic ? '/classic' : '/lab'
  const backLabel = isFromClassic ? 'Back to Portfolio' : 'Back to Corridor'

  return (
    <div
      style={{
        background: '#f0ece4',
        borderTop: '1px solid rgba(42,31,14,0.1)',
        padding: '64px 48px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <p
          style={{
            fontFamily: 'var(--font-gallery, Georgia, serif)',
            fontSize: '14px',
            fontStyle: 'italic',
            color: '#6b5a3e',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}
        >
          Thank you for exploring the collection. These moments capture travel, culture,
          and the beauty of connections across the world.
        </p>

        <div style={{ margin: '32px 0' }}>
          <Link
            href={backHref}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'rgba(200,169,110,0.1)',
              border: '1.5px solid rgba(200,169,110,0.3)',
              borderRadius: '4px',
              color: '#2a1f0e',
              textDecoration: 'none',
              fontSize: '13px',
              fontFamily: "'CabinSketch-Bold', serif",
              letterSpacing: '0.05em',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(200,169,110,0.2)'
              e.currentTarget.style.borderColor = 'rgba(200,169,110,0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(200,169,110,0.1)'
              e.currentTarget.style.borderColor = 'rgba(200,169,110,0.3)'
            }}
          >
            ← {backLabel}
          </Link>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'rgba(42,31,14,0.4)',
            letterSpacing: '0.1em',
            marginTop: '32px',
            textTransform: 'uppercase',
          }}
        >
          © 2024 Yibin Feng · All rights reserved
        </p>
      </div>
    </div>
  )
}

export function GalleryFooter() {
  return (
    <Suspense fallback={null}>
      <Footer />
    </Suspense>
  )
}
