'use client'

import { useAudio } from '@/context/AudioContext'

export function ExplorerBar() {
  const { isMuted, toggleMute } = useAudio()

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '10px 24px 14px',
      pointerEvents: 'none',
    }}>
      <span style={{
        fontFamily: "'CabinSketch-Bold', sans-serif",
        fontSize: '13px',
        letterSpacing: '0.1em',
        color: 'rgba(42,31,14,0.55)',
        userSelect: 'none',
      }}>
        EXPLORER
        <span style={{ margin: '0 8px', opacity: 0.4 }}>—</span>
        Click a door to enter. Audio is currently{' '}
        <span
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            color: isMuted ? 'rgba(42,31,14,0.3)' : 'rgba(42,31,14,0.8)',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            transition: 'color 0.3s',
          }}
          onClick={toggleMute}
        >
          [{isMuted ? 'OFF' : 'ON'}]
        </span>
      </span>
    </div>
  )
}
