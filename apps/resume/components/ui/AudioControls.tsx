'use client'

import { useAudio } from '@/context/AudioContext'

/**
 * AudioControls — BGM and SFX volume sliders + mute toggle.
 * Designed to be embedded inside NavigationUI's map panel.
 */
export function AudioControls() {
  const { bgmVolume, sfxVolume, setBgmVolume, setSfxVolume, isMuted, toggleMute } = useAudio()

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    accentColor: '#c8a96e',
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.15em',
    color: 'rgba(42,31,14,0.5)',
    fontFamily: 'monospace',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={labelStyle}>
          <span>MUSIC</span>
          <span>{Math.round(bgmVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={bgmVolume}
          onChange={e => setBgmVolume(parseFloat(e.target.value))}
          style={sliderStyle}
          aria-label="Music volume"
        />
      </div>
      <div>
        <div style={labelStyle}>
          <span>SFX</span>
          <span>{Math.round(sfxVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sfxVolume}
          onChange={e => setSfxVolume(parseFloat(e.target.value))}
          style={sliderStyle}
          aria-label="SFX volume"
        />
      </div>
      <button
        onClick={toggleMute}
        style={{
          marginTop: 4,
          padding: '6px 12px',
          background: isMuted ? 'rgba(200,169,110,0.15)' : 'transparent',
          border: '1px solid rgba(42,31,14,0.2)',
          borderRadius: 4,
          cursor: 'pointer',
          color: 'rgba(42,31,14,0.6)',
          fontSize: 12,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}
      >
        {isMuted ? '🔇 MUTED' : '🔊 SOUND ON'}
      </button>
    </div>
  )
}
