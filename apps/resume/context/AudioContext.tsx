'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

export type SoundName = 'door_hover' | 'door_open' | 'door_close' | 'corridor_bg' | 'paper_tear' | 'achievement'

export interface SoundHandle {
  stop: () => void
  fade: (durationMs?: number) => void
}

export interface AudioState {
  isMuted: boolean
  sfxVolume: number
  bgmVolume: number
  audioEnabled: boolean

  toggleMute: () => void
  setSfxVolume: (v: number) => void
  setBgmVolume: (v: number) => void
  enableAudio: () => void

  play: (name: SoundName, opts?: { loop?: boolean; volume?: number }) => SoundHandle
  playBgm: (name: SoundName) => void
  stopBgm: () => void
}

const SOUND_PATHS: Record<SoundName, string> = {
  door_hover:   '/sounds/door_hover.mp3',
  door_open:    '/sounds/door_open.mp3',
  door_close:   '/sounds/door_close.mp3',
  corridor_bg:  '/sounds/bg_corridor.ogg',
  paper_tear:   '/sounds/paper_tear.mp3',
  achievement:  '/sounds/achievement.mp3',
}

const AudioCtx = createContext<AudioState | null>(null)

export function useAudio(): AudioState {
  const context = useContext(AudioCtx)
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  // Use consistent defaults for SSR + client initial render to avoid hydration mismatch.
  // localStorage is synced in useEffect after mount.
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [sfxVolume, setSfxVolumeState] = useState<number>(0.8)
  const [bgmVolume, setBgmVolumeState] = useState<number>(0.3)

  // Hydrate from localStorage after mount (client-only)
  useEffect(() => {
    const storedMuted = localStorage.getItem('resume_muted')
    if (storedMuted !== null) setIsMuted(storedMuted === 'true')
    const storedSfx = localStorage.getItem('resume_sfx_vol')
    if (storedSfx !== null) setSfxVolumeState(parseFloat(storedSfx))
    const storedBgm = localStorage.getItem('resume_bgm_vol')
    if (storedBgm !== null) setBgmVolumeState(parseFloat(storedBgm))
  }, [])

  const [audioEnabled, setAudioEnabled] = useState(false)

  const activeSoundsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const bgmNameRef = useRef<SoundName | null>(null)

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('resume_muted', String(isMuted))
    localStorage.setItem('resume_sfx_vol', String(sfxVolume))
    localStorage.setItem('resume_bgm_vol', String(bgmVolume))

    // Update active sounds
    activeSoundsRef.current.forEach((audio) => {
      audio.muted = isMuted
      const base = (audio as HTMLAudioElement & { _baseVolume?: number })._baseVolume ?? 1.0
      audio.volume = Math.max(0, Math.min(1, base * sfxVolume))
    })

    // Update BGM
    if (bgmRef.current) {
      bgmRef.current.muted = isMuted
      bgmRef.current.volume = Math.max(0, Math.min(1, bgmVolume))
    }
  }, [isMuted, sfxVolume, bgmVolume])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  const setSfxVolume = useCallback((v: number) => {
    setSfxVolumeState(Math.max(0, Math.min(1, v)))
  }, [])

  const setBgmVolume = useCallback((v: number) => {
    setBgmVolumeState(Math.max(0, Math.min(1, v)))
  }, [])

  const enableAudio = useCallback(() => {
    setAudioEnabled(true)
  }, [])

  const play = useCallback((name: SoundName, opts: { loop?: boolean; volume?: number } = {}): SoundHandle => {
    const { loop = false, volume = 1.0 } = opts
    const path = SOUND_PATHS[name] ?? `/sounds/${name}.mp3`
    const audio = new Audio(path)

    audio.loop = loop;
    (audio as HTMLAudioElement & { _baseVolume?: number })._baseVolume = volume
    audio.muted = isMuted
    audio.volume = Math.max(0, Math.min(1, volume * sfxVolume))

    // Stop previous sound with same name if exists
    const existing = activeSoundsRef.current.get(name)
    if (existing) {
      existing.pause()
      existing.currentTime = 0
    }
    activeSoundsRef.current.set(name, audio)

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'NotAllowedError' && err.name !== 'NotSupportedError') {
          // silently ignore missing files and autoplay blocks
        }
      })
    }

    const stop = () => {
      audio.pause()
      audio.currentTime = 0
      activeSoundsRef.current.delete(name)
    }

    const fade = (durationMs = 500) => {
      const startVolume = audio.volume
      const stepMs = 100
      const steps = Math.max(1, Math.round(durationMs / stepMs))
      const decrement = startVolume / steps
      let currentStep = 0

      const tick = setInterval(() => {
        currentStep++
        const newVol = Math.max(0, startVolume - decrement * currentStep)
        audio.volume = newVol
        if (currentStep >= steps || newVol <= 0) {
          clearInterval(tick)
          audio.pause()
          audio.currentTime = 0
          activeSoundsRef.current.delete(name)
        }
      }, stepMs)
    }

    return { stop, fade }
  }, [isMuted, sfxVolume])

  const playBgm = useCallback((name: SoundName) => {
    // Stop current BGM first
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.currentTime = 0
    }

    const path = SOUND_PATHS[name] ?? `/sounds/${name}.mp3`
    const audio = new Audio(path)
    audio.loop = true
    audio.muted = isMuted
    audio.volume = Math.max(0, Math.min(1, bgmVolume))
    bgmRef.current = audio
    bgmNameRef.current = name

    audio.play().catch(() => {
      // silently ignore autoplay blocks
    })
  }, [isMuted, bgmVolume])

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.currentTime = 0
      bgmRef.current = null
      bgmNameRef.current = null
    }
  }, [])

  const value: AudioState = {
    isMuted,
    sfxVolume,
    bgmVolume,
    audioEnabled,
    toggleMute,
    setSfxVolume,
    setBgmVolume,
    enableAudio,
    play,
    playBgm,
    stopBgm,
  }

  return (
    <AudioCtx.Provider value={value}>
      {children}
    </AudioCtx.Provider>
  )
}
