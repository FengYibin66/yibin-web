'use client'

import { useState } from 'react'
import type { GalleryImage } from '@/lib/gallery/data'

interface ArtworkFrameProps {
  image: GalleryImage
  index: number
  onExpand: (image: GalleryImage) => void
}

export function ArtworkFrame({ image, index, onExpand }: ArtworkFrameProps) {
  const [loaded, setLoaded] = useState(false)

  // Alternate portrait/landscape sizing for visual variety
  const isPortrait = index % 3 === 0
  const frameWidth = isPortrait ? 'w-[260px]' : 'w-[360px]'
  const frameHeight = isPortrait ? 'h-[340px]' : 'h-[260px]'

  return (
    <div
      className="gallery-artwork flex flex-col items-center cursor-pointer group"
      onClick={() => onExpand(image)}
      style={{ opacity: 0 }} // GSAP will animate this in
    >
      {/* Spotlight */}
      <div className="gallery-spotlight" />

      {/* Frame */}
      <div
        className={`relative ${frameWidth} ${frameHeight} gallery-frame transition-transform duration-700 ease-out group-hover:-translate-y-1.5`}
        style={{
          padding: '10px',
          background: '#f5f0e8',
          boxShadow: `
            0 0 0 8px #c8a96e,
            0 0 0 10px #8b6914,
            0 12px 50px rgba(0,0,0,0.55),
            inset 0 0 20px rgba(0,0,0,0.08)
          `,
        }}
      >
        {/* Mat */}
        <div className="w-full h-full overflow-hidden bg-[#e8e3d8] relative">
          {!loaded && (
            <div className="absolute inset-0 bg-[#ddd9d0] animate-pulse" />
          )}
          <img
            src={image.src}
            alt={image.caption}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>

      {/* Museum label card */}
      <div
        className="mt-4 w-[85%] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: '#f5f0e8',
          borderLeft: '3px solid #c8a96e',
          padding: '8px 12px',
          fontFamily: 'var(--font-gallery, Georgia, serif)',
        }}
      >
        <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#2a1f0e', fontWeight: 500 }}>
          {image.caption}
        </div>
        <div style={{ fontSize: '11px', color: '#6b5a3e', marginTop: '2px' }}>
          {image.location} · {image.year}
        </div>
        <div style={{ fontSize: '10px', color: '#8b7355', marginTop: '1px' }}>
          Photograph · Digital
        </div>
      </div>
    </div>
  )
}
