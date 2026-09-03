import { act, render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioProvider, useAudio } from '@/context/AudioContext'

/**
 * AudioProvider 的回归测试。
 *
 * 三个真实缺陷（审计 C2 / C3 / B2）：
 *
 * - **C2**：`playBgm` 的函数 identity 依赖 `bgmVolume` / `isMuted`，而
 *   `LabScene` 把它放进了 `useEffect` 的依赖数组 → **拖一下音量滑块 BGM 就
 *   从头重放**，拖动过程中反复重放卡顿。`PaperTransition` 对 `play` 是同一
 *   模式（C6：传送动画被 kill 重播）。
 * - **C3**：BGM 首次被浏览器自动播放策略拦下后**永不重试**。直接打开 /lab
 *   或刷新时，只有碰音量滑块才会响。
 * - **B2**：路径来自清单而非内联字面量（见 soundManifest.test.ts）。
 *
 * C2 的修法是把音量/静音改为从 ref 读取，让回调 identity 恒定；这条测试直接
 * 断言 identity 恒定——它是"BGM 不会因为调音量而重放"的可测代理。
 */

class FakeAudio {
  static instances: FakeAudio[] = []
  static playBehavior: 'resolve' | 'reject' = 'resolve'

  src: string
  loop = false
  muted = false
  volume = 1
  currentTime = 0
  paused = true
  playCalls = 0

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  play(): Promise<void> {
    this.playCalls += 1
    if (FakeAudio.playBehavior === 'reject') {
      const err = new Error('blocked')
      err.name = 'NotAllowedError'
      return Promise.reject(err)
    }
    this.paused = false
    return Promise.resolve()
  }

  pause(): void {
    this.paused = true
  }

  canPlayType(mime: string): CanPlayTypeResult {
    // 模拟 WebKit：不支持 OGG
    return mime.includes('ogg') ? '' : 'probably'
  }
}

/** 捕获若干次渲染中 useAudio 返回的回调，用于比对 identity */
function CaptureCallbacks({ sink }: { sink: { playBgm: unknown[]; play: unknown[] } }) {
  const { playBgm, play, setBgmVolume } = useAudio()
  const setter = useRef(setBgmVolume)
  setter.current = setBgmVolume
  sink.playBgm.push(playBgm)
  sink.play.push(play)
  useEffect(() => {
    ;(globalThis as unknown as { __setBgmVolume: (v: number) => void }).__setBgmVolume = (v) =>
      setter.current(v)
  }, [])
  return null
}

describe('AudioProvider', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    FakeAudio.playBehavior = 'resolve'
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof globalThis.Audio)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('playBgm / play 的 identity 不随音量变化（审计 C2 / C6）', () => {
    const sink = { playBgm: [] as unknown[], play: [] as unknown[] }
    render(
      <AudioProvider>
        <CaptureCallbacks sink={sink} />
      </AudioProvider>,
    )

    const before = sink.playBgm.length
    act(() => {
      ;(globalThis as unknown as { __setBgmVolume: (v: number) => void }).__setBgmVolume(0.7)
    })

    expect(sink.playBgm.length, '音量变化应触发重渲染，否则本测试无意义').toBeGreaterThan(before)
    expect(new Set(sink.playBgm).size, 'playBgm identity 变了 → 会被 effect 依赖数组当成新值').toBe(1)
    expect(new Set(sink.play).size, 'play identity 变了 → PaperTransition 的动画会被重播').toBe(1)
  })

  it('BGM 选择 WebKit 能解码的格式，不选 .ogg（审计 C1）', () => {
    function StartBgm() {
      const { playBgm } = useAudio()
      useEffect(() => { playBgm('corridor_bg') }, [playBgm])
      return null
    }
    render(<AudioProvider><StartBgm /></AudioProvider>)

    const bgm = FakeAudio.instances.at(-1)
    expect(bgm).toBeDefined()
    expect(bgm!.src).not.toMatch(/\.ogg$/)
    expect(bgm!.src).toMatch(/\.m4a$/)
  })

  it('自动播放被拦下后，首次用户手势会重试（审计 C3）', async () => {
    FakeAudio.playBehavior = 'reject'
    function StartBgm() {
      const { playBgm } = useAudio()
      useEffect(() => { playBgm('corridor_bg') }, [playBgm])
      return null
    }
    render(<AudioProvider><StartBgm /></AudioProvider>)

    const bgm = FakeAudio.instances.at(-1)!
    expect(bgm.playCalls).toBe(1)
    // 等 rejection 被 catch 处理完，重试监听才注册上
    await act(async () => { await Promise.resolve() })

    FakeAudio.playBehavior = 'resolve'
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
      await Promise.resolve()
    })

    expect(bgm.playCalls, '首次手势后应重试一次 play()').toBe(2)
  })

  it('paper_tear 指向真实存在的文件名（审计 B2）', () => {
    function PlayTear() {
      const { play } = useAudio()
      useEffect(() => { play('paper_tear') }, [play])
      return null
    }
    render(<AudioProvider><PlayTear /></AudioProvider>)

    const sound = FakeAudio.instances.at(-1)!
    expect(sound.src).toBe('/sounds/papersound.mp3')
  })
})
