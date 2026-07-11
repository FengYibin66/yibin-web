'use client'

import { useAudio } from '@/context/AudioContext'

// Phase 4 will replace this with a richer component.
// For now it just toggles mute via the AudioContext.
export function AudioToggle() {
  const { isMuted, toggleMute } = useAudio()

  return (
    <button
      onClick={toggleMute}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 50,
        background: 'rgba(13,18,32,0.6)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
        color: 'rgba(200,169,110,0.8)',
        fontFamily: 'var(--font-mono)',
        fontSize: '16px',
        width: '36px',
        height: '36px',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>
  )
}
