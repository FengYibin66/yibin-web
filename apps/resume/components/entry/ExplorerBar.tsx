'use client'

import { useAudio } from '@/context/AudioContext'

export function ExplorerBar() {
  const { isMuted, toggleMute } = useAudio()

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      background: 'rgba(255,255,255,0.92)',
      border: '2px solid #1a1a1a',
      borderRadius: '12px',
      boxShadow: '3px 3px 0 #1a1a1a',
      padding: '10px 28px',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontFamily: "'CabinSketch-Bold', sans-serif",
        fontSize: '13px',
        letterSpacing: '0.08em',
        color: '#1a1a1a',
        userSelect: 'none',
      }}>
        EXPLORER
        <span style={{ margin: '0 8px', opacity: 0.4 }}>—</span>
        Click a door to enter. Audio is currently{' '}
        <span
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            color: isMuted ? '#999' : '#1a1a1a',
            fontWeight: 'bold',
            transition: 'color 0.2s',
          }}
          onClick={toggleMute}
        >
          [{isMuted ? 'OFF' : 'ON'}]
        </span>
      </span>
    </div>
  )
}
