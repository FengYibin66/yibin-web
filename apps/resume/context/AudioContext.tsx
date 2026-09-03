'use client'

import { useCallback, useEffect, type ReactNode } from 'react'

import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import { useAudioStore } from '@/lib/lab/app/stores/audioStore'
import type { SoundName } from '@/lib/lab/domain/audio/manifest'

export type { SoundName }

/**
 * 音频的 React 门面 —— 现在只是 `useAudioStore` + `audioMixer` 的薄壳
 * （ADR 20260903140618）。
 *
 * 保留 `useAudio()` 与 `AudioProvider` 两个名字是为了不动十来个调用点；
 * 但语义变了三处，都是修 bug：
 *
 * 1. **`AudioProvider` 不再是 Context**，只是个透明容器。于是 Provider
 *    之外的代码也能用音频——原先那道边界是审计 D1 那类问题的形状。
 * 2. **回调 identity 恒定。** `play` / `playBgm` 不再依赖音量，因为音量在
 *    store 里、由 Mixer 订阅。原先它们进了 `useEffect` 依赖数组，拖一下
 *    音量滑块 BGM 就从头重放（C2），传送动画被 kill 重播（C6）。
 * 3. **`sfxVolume` / `bgmVolume` 映射到总线。** 多了第三条 `ambience` 总线，
 *    房间环境音归它管——原先环境音走 drei 的 `<PositionalAudio>`，与静音
 *    完全脱钩（A6）。
 *
 * 这层壳可以在房间组件都改用 mixer 之后删掉。
 */

export interface AudioState {
  isMuted: boolean
  sfxVolume: number
  bgmVolume: number
  ambienceVolume: number

  toggleMute: () => void
  setSfxVolume: (v: number) => void
  setBgmVolume: (v: number) => void
  setAmbienceVolume: (v: number) => void

  /** `opts.volume` 是相对总线音量的倍数，不是绝对值 */
  play: (name: SoundName, opts?: { volume?: number }) => void
  playBgm: (name: SoundName) => void
  stopBgm: () => void
  playAmbience: (name: SoundName, position?: readonly [number, number, number]) => void
  stopAmbience: () => void
}

export function useAudio(): AudioState {
  const muted = useAudioStore(s => s.muted)
  const volumes = useAudioStore(s => s.volumes)
  const toggleMute = useAudioStore(s => s.toggleMute)
  const setVolume = useAudioStore(s => s.setVolume)

  // 这四个回调的依赖里**没有音量**——identity 必须恒定，见文件顶部第 2 点
  const play = useCallback(
    (name: SoundName, opts?: { volume?: number }) => { audioMixer.play(name, opts) },
    [],
  )
  const playBgm = useCallback((name: SoundName) => { audioMixer.music_(name) }, [])
  const stopBgm = useCallback(() => { audioMixer.music_(null) }, [])
  const playAmbience = useCallback(
    (name: SoundName, position?: readonly [number, number, number]) => {
      audioMixer.ambience_(name, position)
    },
    [],
  )
  const stopAmbience = useCallback(() => { audioMixer.ambience_(null) }, [])

  const setSfxVolume = useCallback((v: number) => setVolume('sfx', v), [setVolume])
  const setBgmVolume = useCallback((v: number) => setVolume('music', v), [setVolume])
  const setAmbienceVolume = useCallback((v: number) => setVolume('ambience', v), [setVolume])

  return {
    isMuted: muted,
    sfxVolume: volumes.sfx,
    bgmVolume: volumes.music,
    ambienceVolume: volumes.ambience,
    toggleMute,
    setSfxVolume,
    setBgmVolume,
    setAmbienceVolume,
    play,
    playBgm,
    stopBgm,
    playAmbience,
    stopAmbience,
  }
}

/**
 * 透明容器。
 *
 * 保留它是为了不动 `app/page.tsx` 与 `LabScene` 的 JSX；它现在只做一件事：
 * 卸载时清理 Mixer 的 Howl 实例。**不再建立任何 Context 边界。**
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 挂载时把持久化的偏好推给 Mixer（persist 的 rehydrate 可能早于 Mixer 就绪）
    const { muted, volumes } = useAudioStore.getState()
    audioMixer.sync({ muted, volumes })
    return () => { audioMixer.dispose() }
  }, [])

  return <>{children}</>
}
