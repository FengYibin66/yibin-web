'use client'

import { useState, useEffect } from 'react'
import { useScene } from '@/context/SceneContext'
import { useAudio } from '@/context/AudioContext'
import type { RoomId } from '@/context/SceneContext'
import { AudioControls } from './AudioControls'

const ROOM_LABELS: Record<RoomId, string> = {
  about:        'About',
  projects:     'Projects',
  publications: 'Publications',
  gallery:      'Gallery',
  contact:      'Contact',
}

const btnStyle: React.CSSProperties = {
  background: 'rgba(13,18,32,0.6)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: 'rgba(200,169,110,0.8)',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  padding: '8px 12px',
  fontSize: 14,
  fontFamily: 'monospace',
  transition: 'color 0.2s',
  lineHeight: 1,
}

/**
 * NavigationUI — DOM overlay above Canvas.
 * Shows a right-side button cluster (Back / Map / Audio) after `hasEntered`.
 * Map panel lists all 5 rooms and supports teleportTo().
 */
export function NavigationUI() {
  const { hasEntered, isInRoom, currentRoom, requestExit, teleportTo, isTeleporting } = useScene()
  const { isMuted, toggleMute } = useAudio()
  const [mapOpen, setMapOpen] = useState(false)

  // Close map when starting a teleport or entering a room
  useEffect(() => {
    if (isTeleporting || isInRoom) {
      setMapOpen(false)
    }
  }, [isTeleporting, isInRoom])

  // ESC closes map
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  if (!hasEntered) return null

  return (
    <>
      {/* Right-side button cluster */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 50,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {/* Back button — only while inside a room */}
        {isInRoom && (
          <button
            onClick={requestExit}
            style={btnStyle}
            aria-label="Back to corridor"
          >
            ← Back
          </button>
        )}

        {/* Map / hamburger button */}
        <button
          onClick={() => setMapOpen(o => !o)}
          style={btnStyle}
          aria-label="Open map"
          aria-expanded={mapOpen}
        >
          ☰
        </button>

        {/* Audio mute toggle */}
        <button
          onClick={toggleMute}
          style={btnStyle}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Map panel — slides in from right */}
      {mapOpen && (
        <>
          {/* Click-away overlay */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setMapOpen(false)}
            aria-hidden
          />

          {/* Panel itself */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 280,
              zIndex: 100,
              background: '#f5f0e8',
              borderLeft: '1px solid rgba(42,31,14,0.15)',
              padding: '60px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontFamily: "'CabinSketch-Bold', serif",
              overflowY: 'auto',
            }}
            role="dialog"
            aria-label="Navigation map"
          >
            {/* Close button */}
            <button
              onClick={() => setMapOpen(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                ...btnStyle,
              }}
              aria-label="Close map"
            >
              ✕
            </button>

            <p
              style={{
                fontSize: 11,
                letterSpacing: '0.2em',
                color: 'rgba(42,31,14,0.5)',
                margin: '0 0 8px',
                fontFamily: 'monospace',
              }}
            >
              NAVIGATE
            </p>

            {(Object.keys(ROOM_LABELS) as RoomId[]).map(roomId => (
              <button
                key={roomId}
                onClick={() => {
                  teleportTo(roomId)
                  setMapOpen(false)
                }}
                disabled={isTeleporting}
                style={{
                  background: currentRoom === roomId ? 'rgba(42,31,14,0.08)' : 'transparent',
                  border: '1px solid rgba(42,31,14,0.15)',
                  borderRadius: 6,
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontFamily: "'CabinSketch-Bold', serif",
                  fontSize: 15,
                  color: '#2a1f0e',
                  cursor: isTeleporting ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  opacity: isTeleporting ? 0.5 : 1,
                }}
              >
                {currentRoom === roomId ? '▶ ' : ''}{ROOM_LABELS[roomId]}
              </button>
            ))}

            {/* Embedded audio controls */}
            <AudioControls />
          </div>
        </>
      )}
    </>
  )
}
