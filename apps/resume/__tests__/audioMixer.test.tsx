import { act, render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AudioMixer + audioStore 的回归测试（ADR 20260903140618）。
 *
 * 覆盖的五个真实缺陷：
 *
 * - **C2 / C6**：`playBgm` 的 identity 原先依赖音量，而它在 `useEffect` 的
 *   依赖数组里 → 拖一下音量滑块 BGM 从头重放、传送动画被 kill 重播。
 * - **C1**：走廊 BGM 原先只有 `.ogg`，WebKit 不支持 → 所有 Safari / iOS
 *   完全静音。
 * - **C3**：BGM 被自动播放策略拦下后**永不重试**。
 * - **A6 / C4**：房间环境音（drei PositionalAudio）与成就音效（裸
 *   AudioContext）都绕过了静音开关。
 * - **A5**：环境音走 `useLoader` 会 Suspend，阻塞房间 READY。
 */

// ─── howler 替身 ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  interface HowlOpts {
    src: string[]
    loop?: boolean
    volume?: number
    preload?: boolean
    html5?: boolean
  }

  const instances: FakeHowl[] = []
  const state = { muted: false, playSucceeds: true, pos: [0, 0, 0] as number[] }

  class FakeHowl {
    opts: HowlOpts
    playCalls = 0
    stopped = false
    _volume: number
    volumeCalls: { value: number; id?: number }[] = []
    posCalls: number[][] = []
    pannerCalls: Record<string, unknown>[] = []
    fadeCalls: { from: number; to: number; ms: number }[] = []

    constructor(opts: HowlOpts) {
      this.opts = opts
      this._volume = opts.volume ?? 1
      // 真 howler：preload 为真才在构造时 load()
      this._state = opts.preload === false ? 'unloaded' : 'loaded'
      instances.push(this)
    }

    /**
     * `playing()` 必须反映**调用 play 那一刻**是否成功，而不是读当前标志位。
     *
     * 第一版把 `state.playSucceeds` 直接写进 `playing()`，于是测试里把标志
     * 翻回 true 之后，一个从未真正开始播放的音轨会回溯性地报告"我在播"——
     * 自动播放重试的断言因此假失败。替身建模错了，不是被测代码错了。
     */
    private started = false

    /**
     * 真 howler 的 `state()` / `load()` 语义，照实建模。
     *
     * `preload: false` 时构造函数**不会**调 `load()`，而 `play()` 在
     * `state !== 'loaded'` 时只把这次播放推进内部队列——**它不去拉文件**。
     * 所以不显式 `load()` 的话，声音永远停在 `unloaded`，一声不响。
     *
     * 第一版 fake 里 `play()` 无条件成功，于是它掩盖了一个真 bug：环境音
     * （唯一 `preload: false` 的一类）在实机上创建了 Howl、调了 play、
     * 网络里却没有 amb_*.m4a。替身太宽容 = 测试通过但功能坏掉。
     */
    private _state: 'unloaded' | 'loaded'
    loadCalls = 0

    state(): 'unloaded' | 'loaded' {
      return this._state
    }
    load(): void {
      this.loadCalls += 1
      this._state = 'loaded'
    }

    play(): number {
      this.playCalls += 1
      // 未加载时 howler 只入队，不播 —— started 保持 false
      this.started = this._state === 'loaded' && state.playSucceeds
      return 1
    }
    playing(): boolean {
      return this.started && !this.stopped
    }
    stop(): void {
      this.stopped = true
    }
    unload(): void {
      this.stopped = true
    }
    volume(value?: number, id?: number): number {
      if (value === undefined) return this._volume
      this._volume = value
      this.volumeCalls.push({ value, id })
      return value
    }
    fade(from: number, to: number, ms: number): void {
      this.fadeCalls.push({ from, to, ms })
    }
    pos(x: number, y: number, z: number): void {
      this.posCalls.push([x, y, z])
    }
    pannerAttr(attr: Record<string, unknown>): void {
      this.pannerCalls.push(attr)
    }
  }

  const Howler = {
    mute: vi.fn((value: boolean) => { state.muted = value }),
    pos: vi.fn((x: number, y: number, z: number) => { state.pos = [x, y, z] }),
    orientation: vi.fn(),
    ctx: { state: 'running' as string, resume: vi.fn(() => Promise.resolve()) },
  }

  return { FakeHowl, Howler, instances, state }
})

vi.mock('howler', () => ({ Howl: mocks.FakeHowl, Howler: mocks.Howler }))

// import 必须在 vi.mock 之后（vi.mock 会被提升，这里只是可读性）
const { audioMixer } = await import('@/lib/lab/app/audio/AudioMixer')
const { useAudioStore } = await import('@/lib/lab/app/stores/audioStore')
const { useAudio, AudioProvider } = await import('@/context/AudioContext')
const { SOUND_MANIFEST, soundDef } = await import('@/lib/lab/domain/audio/manifest')

function lastHowl() {
  return mocks.instances.at(-1)!
}

function resetAll() {
  mocks.instances.length = 0
  mocks.state.playSucceeds = true
  mocks.Howler.mute.mockClear()
  mocks.Howler.pos.mockClear()
  mocks.Howler.orientation.mockClear()
  audioMixer.dispose()
  localStorage.clear()
  useAudioStore.setState({ muted: false, volumes: { music: 0.3, sfx: 0.8, ambience: 0.5 } })
  audioMixer.sync({ muted: false, volumes: { music: 0.3, sfx: 0.8, ambience: 0.5 } })
}

beforeEach(resetAll)
afterEach(() => { vi.clearAllTimers() })

// ─── 格式兜底 ────────────────────────────────────────────────────────────────

describe('格式兜底（审计 C1）', () => {
  it('BGM 把 m4a 与 ogg 都交给 howler，且 m4a 在前', () => {
    audioMixer.music_('corridor_bg')
    const src = lastHowl().opts.src
    expect(src[0]).toMatch(/\.m4a$/)
    expect(src).toContain('/sounds/bg_corridor.ogg')
  })

  it('清单里每条都至少有一个 WebKit 能解码的格式', () => {
    for (const [name, def] of Object.entries(SOUND_MANIFEST)) {
      const playable = def.src.filter(s => !/\.(ogg|opus|webm)$/i.test(s))
      expect(playable.length, `${name} 在 Safari / iOS 上会完全静音`).toBeGreaterThan(0)
    }
  })
})

// ─── 全局静音 ────────────────────────────────────────────────────────────────

describe('静音对所有声音生效（审计 A6 / C4）', () => {
  it('toggleMute 走 Howler.mute —— 那是唯一能覆盖 3D 音效的开关', () => {
    act(() => { useAudioStore.getState().toggleMute() })
    expect(mocks.Howler.mute).toHaveBeenCalledWith(true)
    expect(useAudioStore.getState().muted).toBe(true)

    act(() => { useAudioStore.getState().toggleMute() })
    expect(mocks.Howler.mute).toHaveBeenLastCalledWith(false)
  })

  it('静音时已加载的音轨音量归零', () => {
    audioMixer.play('door_hover')
    const howl = lastHowl()
    act(() => { useAudioStore.getState().toggleMute() })
    expect(howl.volume()).toBe(0)
  })
})

// ─── 3D 定位保留 ─────────────────────────────────────────────────────────────

describe('环境音保留 3D 距离衰减（不是退化成 2D）', () => {
  it('spatial 参数逐项来自声明', () => {
    audioMixer.ambience_('amb_contact', [1, 2, -3])
    const howl = lastHowl()
    const declared = soundDef('amb_contact').spatial!

    expect(howl.posCalls.at(-1)).toEqual([1, 2, -3])
    const panner = howl.pannerCalls.at(-1)!
    expect(panner.refDistance).toBe(declared.refDistance)
    expect(panner.rolloffFactor).toBe(declared.rolloffFactor)
    expect(panner.distanceModel).toBe(declared.distanceModel)
    expect(panner.panningModel).toBe('HRTF')
  })

  it('syncListener 把相机位姿交给 Howler', () => {
    audioMixer.syncListener([1, 2, 3], [0, 0, -1], [0, 1, 0])
    expect(mocks.Howler.pos).toHaveBeenCalledWith(1, 2, 3)
    expect(mocks.Howler.orientation).toHaveBeenCalledWith(0, 0, -1, 0, 1, 0)
  })

  it('环境音不预载 —— 它不该占首屏带宽，也不该阻塞房间 READY（审计 A5）', () => {
    audioMixer.ambience_('amb_projects', [0, 0, 0])
    expect(lastHowl().opts.preload).toBe(false)
  })

  it('环境音进房时显式 load —— 不 load 的话 howler 只入队，一个字节都不请求', () => {
    audioMixer.ambience_('amb_projects', [0, 0, 0])
    const howl = lastHowl()
    // 这两条缺一不可：只断言 play 被调过的话，实机那次「Howl 存在、state
    // 为 unloaded、网络无请求」的故障照样能通过测试
    expect(howl.loadCalls, '没显式 load，环境音永远停在 unloaded').toBe(1)
    expect(howl.state()).toBe('loaded')
    expect(howl.playing(), '入队但未加载 = 不出声').toBe(true)
  })

  it('已预载的声音不重复 load', () => {
    audioMixer.play('door_hover')
    expect(lastHowl().loadCalls).toBe(0)
  })

  it('2D 音效预载 —— 门 hover 要立刻响', () => {
    audioMixer.play('door_hover')
    expect(lastHowl().opts.preload).toBe(true)
  })

  it('切换房间时旧环境音淡出', () => {
    audioMixer.ambience_('amb_about', [0, 0, 0])
    const first = lastHowl()
    audioMixer.ambience_('amb_contact', [0, 0, 0])
    expect(first.fadeCalls.at(-1)?.to).toBe(0)
  })

  it('传 null 停止环境音', () => {
    audioMixer.ambience_('amb_about', [0, 0, 0])
    const howl = lastHowl()
    audioMixer.ambience_(null)
    expect(howl.fadeCalls.at(-1)?.to).toBe(0)
  })
})

// ─── 相对音量 ────────────────────────────────────────────────────────────────

describe('play 的 volume 是相对倍数，不是绝对值', () => {
  it('0.6 倍 = 总线音量 × 0.6', () => {
    audioMixer.play('paper_tear', { volume: 0.6 })
    const howl = lastHowl()
    expect(howl.volumeCalls.at(-1)?.value).toBeCloseTo(0.8 * 0.6, 6)
  })

  it('用户调低 SFX 后这一声跟着降 —— 原实现当绝对值传，反而相对变大', () => {
    act(() => { useAudioStore.getState().setVolume('sfx', 0.2) })
    audioMixer.play('paper_tear', { volume: 0.6 })
    expect(lastHowl().volumeCalls.at(-1)?.value).toBeCloseTo(0.2 * 0.6, 6)
  })
})

// ─── 自动播放解锁 ─────────────────────────────────────────────────────────────

describe('自动播放被拦下后重试（审计 C3）', () => {
  it('首次手势重试一次 play()', () => {
    mocks.state.playSucceeds = false
    audioMixer.music_('corridor_bg')
    const howl = lastHowl()
    expect(howl.playCalls).toBe(1)

    mocks.state.playSucceeds = true
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(howl.playCalls).toBe(2)
  })

  it('播放成功时不注册监听 —— 不该给正常路径加副作用', () => {
    audioMixer.play('door_open')
    const howl = lastHowl()
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(howl.playCalls).toBe(1)
  })
})

// ─── 回调 identity ───────────────────────────────────────────────────────────

function CaptureCallbacks({ sink }: { sink: { play: unknown[]; playBgm: unknown[] } }) {
  const { play, playBgm, setBgmVolume } = useAudio()
  const setter = useRef(setBgmVolume)
  setter.current = setBgmVolume
  sink.play.push(play)
  sink.playBgm.push(playBgm)
  useEffect(() => {
    ;(globalThis as unknown as { __setBgm: (v: number) => void }).__setBgm = v => setter.current(v)
  }, [])
  return null
}

describe('回调 identity 恒定（审计 C2 / C6）', () => {
  it('音量变化不改变 play / playBgm 的 identity', () => {
    const sink = { play: [] as unknown[], playBgm: [] as unknown[] }
    render(<AudioProvider><CaptureCallbacks sink={sink} /></AudioProvider>)

    const before = sink.playBgm.length
    act(() => {
      ;(globalThis as unknown as { __setBgm: (v: number) => void }).__setBgm(0.7)
    })

    expect(sink.playBgm.length, '音量变化应触发重渲染，否则本测试无意义')
      .toBeGreaterThan(before)
    expect(new Set(sink.playBgm).size, 'identity 变了 → effect 依赖数组会当成新值，BGM 重放').toBe(1)
    expect(new Set(sink.play).size).toBe(1)
  })

  it('AudioProvider 不再建立 Context 边界 —— 没有它 useAudio 也能用', () => {
    const sink = { play: [] as unknown[], playBgm: [] as unknown[] }
    expect(() => render(<CaptureCallbacks sink={sink} />)).not.toThrow()
    expect(sink.play.length).toBeGreaterThan(0)
  })
})

// ─── 旧偏好迁移 ──────────────────────────────────────────────────────────────

describe('旧 localStorage 偏好迁移', () => {
  it('三个旧 key 的设置不会静默丢失', async () => {
    localStorage.clear()
    localStorage.setItem('resume_muted', 'true')
    localStorage.setItem('resume_bgm_vol', '0.1')
    localStorage.setItem('resume_sfx_vol', '0.4')

    // 重新加载 store 模块，触发 persist 的 merge
    vi.resetModules()
    const fresh = await import('@/lib/lab/app/stores/audioStore')
    const state = fresh.useAudioStore.getState()

    expect(state.muted, '用户"我明明关过声音"的设置被重置了').toBe(true)
    expect(state.volumes.music).toBeCloseTo(0.1, 6)
    expect(state.volumes.sfx).toBeCloseTo(0.4, 6)
  })

  it('脏数据不产生 NaN 音量', async () => {
    localStorage.clear()
    localStorage.setItem('resume_bgm_vol', 'not a number')
    vi.resetModules()
    const fresh = await import('@/lib/lab/app/stores/audioStore')
    expect(Number.isFinite(fresh.useAudioStore.getState().volumes.music)).toBe(true)
  })
})
