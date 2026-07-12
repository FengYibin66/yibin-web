'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { galleryRooms } from '@/lib/gallery/data'
import type { GalleryImage } from '@/lib/gallery/data'
import { GalleryRoom } from './GalleryRoom'
import { GalleryLightbox } from './GalleryLightbox'

export function GalleryTrack() {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    // Short delay to ensure DOM is laid out
    const timer = setTimeout(() => {
      const container = containerRef.current
      const track = trackRef.current
      if (!container || !track) return

      const totalWidth = track.scrollWidth - window.innerWidth

      gsap.to(track, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 1.2,
          end: () => `+=${totalWidth}`,
          onUpdate: () => {
            // Fade in artworks as they enter viewport during scroll
            const artworks = track.querySelectorAll('.gallery-artwork')
            artworks.forEach((el) => {
              const rect = el.getBoundingClientRect()
              if (rect.left < window.innerWidth * 1.2 && rect.right > -100) {
                gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
              }
            })
          },
        },
      })
    }, 500)

    return () => {
      clearTimeout(timer)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])

  return (
    <>
      {/* Entry fade from dark to warm cream */}
      <motion.div
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{ background: '#070b12' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      <div ref={containerRef} className="relative">
        {/* Gallery horizontal track */}
        <div
          ref={trackRef}
          className="flex h-screen"
          style={{ background: '#f0ece4', willChange: 'transform' }}
        >
          {/* Entry hall */}
          <div
            className="flex-shrink-0 w-[40vw] h-screen flex items-center justify-center"
            style={{ background: '#f0ece4' }}
          >
            <div className="text-center" style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}>
              <div className="text-xs uppercase tracking-[0.5em] mb-4" style={{ color: '#8b7355' }}>
                The Collection of
              </div>
              <h1 className="text-6xl font-light mb-3" style={{ color: '#2a1f0e' }}>
                Yibin Feng
              </h1>
              <div className="w-24 h-px mx-auto mb-4" style={{ background: '#c8a96e' }} />
              <p className="text-sm italic" style={{ color: '#6b5a3e' }}>
                Photography · 2019 – 2024
              </p>
              <p className="text-xs mt-6 animate-bounce" style={{ color: '#8b7355' }}>
                Scroll to explore ↓
              </p>
            </div>
          </div>

          {/* Rooms */}
          {galleryRooms.map((room) => (
            <GalleryRoom key={room.id} room={room} onExpand={setLightboxImage} />
          ))}

          {/* Exit hall */}
          <div
            className="flex-shrink-0 w-[30vw] h-screen flex items-center justify-center"
            style={{ background: '#f0ece4' }}
          >
            <div className="text-center" style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}>
              <div className="w-24 h-px mx-auto mb-6" style={{ background: '#c8a96e' }} />
              <p className="text-sm italic" style={{ color: '#6b5a3e' }}>
                End of Collection
              </p>
            </div>
          </div>
        </div>
      </div>

      <GalleryLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}
