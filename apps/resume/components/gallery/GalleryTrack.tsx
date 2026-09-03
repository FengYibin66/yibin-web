'use client'

import { useRef, useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { galleryRooms, galleryYearLabel } from '@/lib/gallery/data'
import type { GalleryImage } from '@/lib/gallery/data'
import { recordAchievement } from '@/lib/lab/achievementStorage'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { GalleryRoom } from './GalleryRoom'
import { GalleryLightbox } from './GalleryLightbox'

// Back link needs useSearchParams (?from=classic) — wrapped in Suspense
// per Next.js requirement for static export.
function ExitBackLink() {
  const params = useSearchParams()
  const isFromClassic = params.get('from') === 'classic'
  return (
    <Link
      href={isFromClassic ? '/classic' : '/lab'}
      style={{
        display: 'inline-block',
        padding: '12px 24px',
        background: 'rgba(200,169,110,0.1)',
        border: '1.5px solid rgba(200,169,110,0.3)',
        borderRadius: '4px',
        color: '#2a1f0e',
        textDecoration: 'none',
        fontSize: '13px',
        fontFamily: 'var(--font-sketch-bold)',
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
      ← {isFromClassic ? 'Back to Portfolio' : 'Back to Corridor'}
    </Link>
  )
}

export function GalleryTrack() {
  const { locale } = useLocale()
  const copyright = content[locale].footer.copyright
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null)

  /**
   * 打开照片时记成就 `gallery_inspect`（"Art Critic"）。
   *
   * 这条成就原先**永远解不开**：唯一解锁调用在零渲染方的
   * `components/rooms/GalleryRoom.tsx`（已删），而本路由在
   * `AchievementsProvider` 之外拿不到 `unlockAchievement`。所以直接写模块级
   * 存储，回到 Lab 时 Provider 初始化会读到（审计 D1）。
   */
  const handleExpand = useCallback((image: GalleryImage) => {
    setLightboxImage(image)
    recordAchievement('gallery_inspect')
  }, [])

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
                Photography · {galleryYearLabel()}
              </p>
              <p className="text-xs mt-6 animate-bounce" style={{ color: '#8b7355' }}>
                Scroll to explore ↓
              </p>
            </div>
          </div>

          {/* Rooms */}
          {galleryRooms.map((room, i) => (
            <GalleryRoom key={room.id} room={room} index={i} onExpand={handleExpand} />
          ))}

          {/* Exit hall — closing statement lives inside the horizontal flow,
              so the journey ends where the scroll ends (no extra vertical
              footer below the track). */}
          <div
            className="flex-shrink-0 w-[70vw] md:w-[50vw] h-screen flex items-center justify-center"
            style={{ background: '#f0ece4' }}
          >
            <div
              className="text-center px-8"
              style={{ fontFamily: 'var(--font-gallery, Georgia, serif)', maxWidth: '480px' }}
            >
              <div className="w-24 h-px mx-auto mb-6" style={{ background: '#c8a96e' }} />
              <p className="text-sm italic mb-6" style={{ color: '#6b5a3e' }}>
                End of Collection
              </p>
              <p
                className="text-sm italic mb-8"
                style={{ color: '#6b5a3e', lineHeight: 1.7 }}
              >
                Thank you for exploring the collection. These moments capture travel,
                culture, and the beauty of connections across the world.
              </p>
              <Suspense fallback={null}>
                <ExitBackLink />
              </Suspense>
              <p
                className="mt-10 text-[10px] uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(42,31,14,0.4)',
                  letterSpacing: '0.1em',
                }}
              >
                {/* 版权年份取自 content.footer，与 Classic 页脚同源——两处
                    各写一个数字时它们迟早会不一致（审计 F10：这里曾是 2024，
                    Classic 页脚是 2026）。 */}
                {copyright} · All rights reserved
              </p>
            </div>
          </div>
        </div>
      </div>

      <GalleryLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}
