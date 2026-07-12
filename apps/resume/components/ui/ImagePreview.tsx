'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

interface ImageLightboxProps {
  src: string
  alt?: string
  caption?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt = '', caption, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(7,11,18,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || caption || 'Image preview'}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 text-sm"
        style={{ color: 'var(--accent-primary)' }}
      >
        ✕
      </button>
      <figure
        className="max-w-[min(960px,94vw)] max-h-[88vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl"
        />
        {(caption || alt) ? (
          <figcaption className="mt-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {caption || alt}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body,
  )
}

interface ImagePreviewProps {
  src: string
  alt?: string
  caption?: string
  className?: string
  imgClassName?: string
  /** Rounded container style */
  rounded?: string
  /** Always show a compact eye chip on touch devices / small screens */
  children?: ReactNode
}

/**
 * Clickable image with hover eye affordance (desktop) and always-visible
 * eye chip on small screens. Opens a full-screen lightbox preview.
 */
export function ImagePreview({
  src,
  alt = '',
  caption,
  className,
  imgClassName,
  rounded = 'rounded-lg',
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          'group relative block w-full overflow-hidden cursor-zoom-in p-0 border-0 bg-transparent',
          rounded,
          className,
        )}
        aria-label={alt ? `Preview ${alt}` : 'Preview image'}
      >
        <img
          src={src}
          alt={alt}
          className={cn('w-full h-full object-cover block', imgClassName)}
          loading="lazy"
        />

        {/* Desktop hover veil + eye */}
        <span
          className={cn(
            'pointer-events-none absolute inset-0 hidden sm:flex items-center justify-center',
            'bg-black/0 opacity-0 transition-all duration-200',
            'group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100',
          )}
        >
          <span
            className="inline-flex items-center justify-center w-11 h-11 rounded-full"
            style={{ background: 'rgba(0,212,255,0.18)', color: '#7fe9ff', border: '1px solid #00d4ff66' }}
          >
            <EyeIcon size={20} />
          </span>
        </span>

        {/* Mobile / touch: persistent eye chip */}
        <span
          className="sm:hidden absolute bottom-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#7fe9ff', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <EyeIcon size={14} />
        </span>
      </button>

      {open ? (
        <ImageLightbox src={src} alt={alt} caption={caption} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

/** Render bio text with **bold** markers. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
