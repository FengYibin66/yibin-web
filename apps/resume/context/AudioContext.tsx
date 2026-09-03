'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

import { pickPlayableSource, type SoundName } from '@/lib/lab/domain/audio/manifest'

export type { SoundName }

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

/**
 * 格式探测元素：只建一次，用来问浏览器"这个 MIME 你能解吗"。
 *
 * 需要它是因为走廊 BGM 现在有 m4a 与 ogg 两个候选——WebKit 不支持 OGG
 * Vorbis，原先只有 .ogg 一种格式时 BGM 在所有 Safari 与全部 iOS 浏览器
 * 完全静音（审计 C1）。
 */
let probeElement: HTMLAudioElement | null = null

function canPlay(mime: string): CanPlayTypeResult {
  if (typeof Audio === 'undefined') return 'maybe' // SSR：不做取舍，交给客户端
  probeElement ??= new Audio()
  return probeElement.canPlayType(mime)
}

function sourceFor(name: SoundName): string {
  return pickPlayableSource(name, canPlay)
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

  /**
   * 音量与静音同时存在 state（给 UI 渲染）与 ref（给回调读）两份。
   *
   * 需要 ref 那一份是因为：`play` / `playBgm` 若把音量放进 useCallback 依赖，
   * 它们的 identity 就会随音量变化，而 `LabScene` 与 `PaperTransition` 把这两个
   * 回调放进了 `useEffect` 的依赖数组 → **拖一下音量滑块，BGM 从头重放、传送
   * 动画被 kill 重播**（审计 C2 / C6）。从 ref 读取让 identity 恒定。
   */
  const isMutedRef = useRef(isMuted)
  const sfxVolumeRef = useRef(sfxVolume)
  const bgmVolumeRef = useRef(bgmVolume)
  isMutedRef.current = isMuted
  sfxVolumeRef.current = sfxVolume
  bgmVolumeRef.current = bgmVolume

  /**
   * 自动播放解锁：被 `NotAllowedError` 拦下的播放挂在这里，等第一次用户手势重试。
   *
   * 原先只在 mount 时调一次 `play()`，被拦下就静默失败且**永不重试**——直接
   * 打开 /lab 或刷新时，只有碰音量滑块才会响（审计 C3）。
   */
  const pendingUnlockRef = useRef<(() => void) | null>(null)

  const armAutoplayRetry = useCallback((retry: () => void) => {
    pendingUnlockRef.current = retry
    if (typeof window === 'undefined') return

    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
      const pending = pendingUnlockRef.current
      pendingUnlockRef.current = null
      pending?.()
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    window.addEventListener('touchstart', onGesture)
  }, [])

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
    const audio = new Audio(sourceFor(name))

    audio.loop = loop;
    (audio as HTMLAudioElement & { _baseVolume?: number })._baseVolume = volume
    audio.muted = isMutedRef.current
    audio.volume = Math.max(0, Math.min(1, volume * sfxVolumeRef.current))

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
    // deps 刻意为空：音量与静音从 ref 读，identity 必须恒定（见 isMutedRef 的注释）
  }, [])

  const playBgm = useCallback((name: SoundName) => {
    // Stop current BGM first
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.currentTime = 0
    }

    const audio = new Audio(sourceFor(name))
    audio.loop = true
    audio.muted = isMutedRef.current
    audio.volume = Math.max(0, Math.min(1, bgmVolumeRef.current))
    bgmRef.current = audio
    bgmNameRef.current = name

    const attempt = () => {
      audio.play().catch((err: unknown) => {
        // 只有"被自动播放策略拦下"值得重试；文件缺失 / 格式不支持重试也没用
        if ((err as { name?: string } | null)?.name !== 'NotAllowedError') return
        // 仍是当前 BGM 才重试——期间可能已经切歌或 stopBgm
        armAutoplayRetry(() => { if (bgmRef.current === audio) attempt() })
      })
    }
    attempt()
  }, [armAutoplayRetry])

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
