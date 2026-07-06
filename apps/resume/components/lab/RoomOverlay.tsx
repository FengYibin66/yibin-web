'use client'

import { useEffect } from 'react'
import { AboutSection } from '@/components/sections/AboutSection'
import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { PublicationsSection } from '@/components/sections/PublicationsSection'
import { ContactSection } from '@/components/sections/ContactSection'

type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact' | null

interface RoomOverlayProps {
  room: RoomId
  onClose: () => void
}

const ROOM_COMPONENTS: Record<Exclude<RoomId, null>, React.ComponentType> = {
  about:        AboutSection,
  projects:     ProjectsSection,
  publications: PublicationsSection,
  gallery:      () => { window.location.href = '/gallery'; return null },
  contact:      ContactSection,
}

export function RoomOverlay({ room, onClose }: RoomOverlayProps) {
  // Close on Escape — only active when a room is open
  useEffect(() => {
    if (!room) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, room])

  if (!room) return null

  const SectionComponent = ROOM_COMPONENTS[room]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflowY: 'auto',
        background: 'var(--bg-base)',
      }}
    >
      {/* Back to corridor button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 110,
          padding: '8px 16px',
          background: 'rgba(13,18,32,0.8)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          color: '#f0f4ff',
          fontSize: '13px',
          cursor: 'pointer',
          borderRadius: '6px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
        }}
        aria-label="Return to corridor"
      >
        ← Back to corridor
      </button>

      <div style={{ paddingTop: '60px' }}>
        <SectionComponent />
      </div>
    </div>
  )
}
