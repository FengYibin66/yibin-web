'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useScene } from '@/context/SceneContext'
import { useAudio } from '@/context/AudioContext'
import { useAchievements } from '@/context/AchievementsContext'
import type { RoomId } from '@/context/SceneContext'
import { AchievementPopup } from './AchievementPopup'
import { AchievementsPanel } from './AchievementsPanel'

const ROOM_LABELS: Record<RoomId, string> = {
  about:        'About',
  projects:     'Projects',
  publications: 'Publications',
  gallery:      'Gallery',
  contact:      'Contact',
}

export function NavigationUI() {
  const { hasEntered, isInRoom, currentRoom, requestExit, teleportTo, isTeleporting } = useScene()
  const { isMuted, toggleMute, sfxVolume, setSfxVolume, bgmVolume, setBgmVolume } = useAudio()
  const { showTutorial, unlockAchievement } = useAchievements()

  const [mapOpen, setMapOpen]               = useState(false)
  const [audioOpen, setAudioOpen]           = useState(false)
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  const [isExiting, setIsExiting]           = useState(false)
  const [isUIHidden, setIsUIHidden]         = useState(false)

  const mapPanelRef  = useRef<HTMLDivElement>(null)
  const mapCloseRef  = useRef<HTMLButtonElement>(null)

  // Show tutorial hints at the right moments
  useEffect(() => {
    if (!hasEntered && !isTeleporting) {
      showTutorial('corridor_enter')
    } else if (hasEntered && !isTeleporting && !isInRoom) {
      showTutorial('corridor_explore')
    }
  }, [hasEntered, isTeleporting, isInRoom, showTutorial])

  // Close panels when teleporting or in room
  useEffect(() => {
    if (isInRoom || isTeleporting) {
      setMapOpen(false)
      setAudioOpen(false)
      setAchievementsOpen(false)
      setIsExiting(false)
    }
  }, [isInRoom, isTeleporting])

  useEffect(() => {
    if (!isInRoom) setIsExiting(false)
  }, [isInRoom])

  // Inspect event hides UI (e.g. when a painting is inspected)
  useEffect(() => {
    const handleInspectChange = (e: CustomEvent<boolean>) => {
      setIsUIHidden(e.detail)
      if (e.detail) {
        setMapOpen(false)
        setAudioOpen(false)
        setAchievementsOpen(false)
      }
    }
    window.addEventListener('inspectChange', handleInspectChange as EventListener)
    return () => window.removeEventListener('inspectChange', handleInspectChange as EventListener)
  }, [])

  // Focus management for map panel
  useEffect(() => {
    if (mapOpen) setTimeout(() => mapCloseRef.current?.focus(), 100)
  }, [mapOpen])

  // ESC closes any open panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mapOpen) setMapOpen(false)
        if (audioOpen) setAudioOpen(false)
        if (achievementsOpen) setAchievementsOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mapOpen, audioOpen, achievementsOpen])

  // Focus trap for map panel
  const handleMapKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !mapPanelRef.current) return
    const focusable = mapPanelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  const handleRoomClick = useCallback((roomId: RoomId) => {
    if (roomId === currentRoom || isTeleporting) return
    setMapOpen(false)
    setAudioOpen(false)
    setAchievementsOpen(false)
    teleportTo(roomId)
  }, [currentRoom, isTeleporting, teleportTo])

  const handleBackClick = useCallback(() => {
    setIsExiting(true)
    requestExit()
  }, [requestExit])

  const closeAll = useCallback(() => {
    setMapOpen(false)
    setAudioOpen(false)
    setAchievementsOpen(false)
  }, [])

  if (!hasEntered) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {/* Global achievement popup */}
      <AchievementPopup />

      {/* Back button */}
      {isInRoom && (
        <button
          onClick={handleBackClick}
          style={{
            position: 'absolute',
            top: 20, left: 20,
            pointerEvents: 'auto',
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
            letterSpacing: '0.05em',
            opacity: isExiting ? 0 : 1,
            transition: 'opacity 0.3s ease',
          }}
          aria-label="Back to corridor"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Right-side controls */}
      <div
        style={{
          position: 'absolute',
          top: 16, right: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'auto',
          opacity: isUIHidden ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Map button */}
        <NavButton
          onClick={() => { setMapOpen(o => !o); setAudioOpen(false); setAchievementsOpen(false) }}
          active={mapOpen}
          aria-label="Open map"
          aria-expanded={mapOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </NavButton>

        {/* Audio button */}
        <NavButton
          onClick={() => { setAudioOpen(o => !o); setMapOpen(false); setAchievementsOpen(false) }}
          active={audioOpen}
          aria-label="Audio settings"
          aria-expanded={audioOpen}
        >
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
              <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
              <path d="M15 9a5 5 0 0 1 0 6" /><path d="M18 5a9 9 0 0 1 0 14" />
            </svg>
          )}
        </NavButton>

        {/* Achievements button */}
        <NavButton
          onClick={() => { setAchievementsOpen(o => !o); setMapOpen(false); setAudioOpen(false) }}
          active={achievementsOpen}
          aria-label="Achievements"
          aria-expanded={achievementsOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10M5 4h14v5a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />
            <path d="M5 9H3V6h2" /><path d="M19 9h2V6h-2" />
          </svg>
        </NavButton>
      </div>

      {/* Map panel — drops from top */}
      {mapOpen && (
        <div
          ref={mapPanelRef}
          onKeyDown={handleMapKeyDown}
          role="dialog"
          aria-label="Navigation map"
          style={{
            position: 'absolute',
            top: 0, right: 16,
            width: 280,
            background: '#ffffff',
            padding: '16px 16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            fontFamily: "'CabinSketch-Bold', serif",
            pointerEvents: 'auto',
            zIndex: 100,
            clipPath: `polygon(
              0% 0%, 100% 0%,
              99% 3%, 100% 6%, 98% 10%, 100% 14%, 99% 18%, 100% 22%, 98% 26%, 100% 30%,
              99% 35%, 100% 40%, 98% 45%, 100% 50%, 99% 55%, 100% 60%, 98% 65%, 100% 70%,
              99% 75%, 100% 80%, 98% 85%, 100% 90%, 99% 95%, 100% 100%,
              96% 99%, 92% 100%, 88% 98%, 84% 100%, 80% 99%, 76% 100%, 72% 98%, 68% 100%,
              64% 99%, 60% 100%, 56% 98%, 52% 100%, 48% 99%, 44% 100%, 40% 98%, 36% 100%,
              32% 99%, 28% 100%, 24% 98%, 20% 100%, 16% 99%, 12% 100%, 8% 98%, 4% 100%, 0% 99%,
              1% 95%, 0% 90%, 2% 85%, 0% 80%, 1% 75%, 0% 70%, 2% 65%, 0% 60%,
              1% 55%, 0% 50%, 2% 45%, 0% 40%, 1% 35%, 0% 30%, 2% 26%, 0% 22%,
              1% 18%, 0% 14%, 2% 10%, 0% 6%, 1% 3%, 0% 0%
            )`,
            filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.12))',
          }}
        >
          {/* Paper texture */}
          <div style={{
            position: 'absolute', inset: '-20%',
            background: "url('/textures/paper-texture.webp') center center / cover",
            zIndex: -1,
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '2px dashed #bbb', position: 'relative', zIndex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '1.5px', color: '#1a1a1a' }}>MAP</h3>
            <button
              ref={mapCloseRef}
              onClick={() => setMapOpen(false)}
              aria-label="Close map"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.6, display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', zIndex: 1 }}>
            {(Object.keys(ROOM_LABELS) as RoomId[]).map(roomId => (
              <button
                key={roomId}
                onClick={() => handleRoomClick(roomId)}
                disabled={isTeleporting}
                style={{
                  background: currentRoom === roomId ? 'rgba(42,31,14,0.08)' : 'transparent',
                  border: '1px solid rgba(42,31,14,0.12)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontFamily: "'CabinSketch-Bold', serif",
                  fontSize: 14,
                  color: '#1a1a1a',
                  cursor: isTeleporting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  opacity: isTeleporting ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {currentRoom === roomId && (
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" fill="#1a1a1a" />
                  </svg>
                )}
                {ROOM_LABELS[roomId]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio panel */}
      {audioOpen && (
        <div
          style={{
            position: 'absolute',
            top: 56, right: 16,
            width: 240,
            background: '#ffffff',
            padding: '16px 16px 20px',
            fontFamily: "'CabinSketch-Bold', serif",
            pointerEvents: 'auto',
            zIndex: 100,
            clipPath: `polygon(
              0% 0%, 100% 0%,
              98% 10%, 100% 20%, 97% 35%, 100% 50%, 98% 65%, 100% 80%, 97% 90%, 100% 100%,
              90% 97%, 80% 100%, 70% 96%, 60% 100%, 50% 97%, 40% 100%, 30% 96%, 20% 100%, 10% 97%, 0% 100%,
              2% 90%, 0% 80%, 3% 65%, 0% 50%, 2% 35%, 0% 20%, 3% 10%, 0% 0%
            )`,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))',
          }}
        >
          <div style={{ position: 'absolute', inset: '-20%', background: "url('/textures/paper-texture.webp') center center / cover", zIndex: -1 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '2px dashed #bbb' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '1.5px', color: '#1a1a1a' }}>AUDIO</h3>
            <button onClick={() => setAudioOpen(false)} aria-label="Close audio" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#444' }}>
                <span>Music</span>
                <span>{Math.round(bgmVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={bgmVolume}
                onChange={e => setBgmVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#2a1f0e' }}
                aria-label="Music volume"
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#444' }}>
                <span>SFX</span>
                <span>{Math.round(sfxVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={sfxVolume}
                onChange={e => setSfxVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#2a1f0e' }}
                aria-label="SFX volume"
              />
            </div>

            <button
              onClick={toggleMute}
              style={{
                background: isMuted ? 'rgba(42,31,14,0.08)' : 'transparent',
                border: '1px solid rgba(42,31,14,0.2)',
                borderRadius: 6, padding: '8px 12px',
                fontFamily: "'CabinSketch-Bold', serif",
                fontSize: 12, color: '#1a1a1a',
                cursor: 'pointer', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
        </div>
      )}

      {/* Achievements panel */}
      <AchievementsPanel isOpen={achievementsOpen} onClose={() => setAchievementsOpen(false)} />

      {/* Click-away overlay — z-index 50 keeps it below panels (100) and AchievementsPanel (95) */}
      {(mapOpen || audioOpen || achievementsOpen) && (
        <div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', zIndex: 50 }}
          onClick={closeAll}
          aria-hidden
        />
      )}
    </div>
  )
}

// ─── Small reusable nav button ────────────────────────────────────────────────

function NavButton({
  onClick,
  active,
  children,
  ...props
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
        border: `1.5px solid ${active ? 'rgba(42,31,14,0.3)' : 'rgba(42,31,14,0.12)'}`,
        borderRadius: 8,
        width: 40, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: '#2a1f0e',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
}
