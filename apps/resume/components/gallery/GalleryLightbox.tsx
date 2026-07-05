'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { GalleryImage } from '@/lib/gallery/data'

interface LightboxProps {
  image: GalleryImage | null
  onClose: () => void
}

export function GalleryLightbox({ image, onClose }: LightboxProps) {
  return (
    <AnimatePresence>
      {image && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center cursor-zoom-out"
          style={{ background: 'rgba(20, 14, 6, 0.92)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onClose}
        >
          <motion.div
            className="max-w-[85vw] max-h-[80vh] flex flex-col items-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
          >
            {/* Frame */}
            <div
              style={{
                padding: '12px',
                background: '#f5f0e8',
                boxShadow: '0 0 0 10px #c8a96e, 0 0 0 12px #8b6914, 0 30px 80px rgba(0,0,0,0.8)',
              }}
            >
              <img
                src={image.src}
                alt={image.caption}
                className="max-w-full max-h-[65vh] object-contain block"
              />
            </div>
            {/* Label */}
            <div
              className="mt-4 text-center"
              style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}
            >
              <div style={{ fontSize: '16px', fontStyle: 'italic', color: '#f5f0e8' }}>{image.caption}</div>
              <div style={{ fontSize: '13px', color: '#c8a96e', marginTop: '4px' }}>
                {image.location} · {image.year}
              </div>
            </div>
          </motion.div>
          {/* Close hint */}
          <div className="absolute top-6 right-8 text-[#c8a96e] text-sm" style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}>
            Click anywhere to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
