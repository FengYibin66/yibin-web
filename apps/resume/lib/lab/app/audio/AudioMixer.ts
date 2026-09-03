import { Howl, Howler } from 'howler'

import {
  soundDef,
  type AudioBus,
  type SoundName,
} from '@/lib/lab/domain/audio/manifest'

/**
 * Lab 的唯一音频入口（ADR 20260903140618）。
 *
 * 取代原先**三套互不知情的实现**：
 *
 * 1. `context/AudioContext.tsx` —— 走廊 BGM 与 2D 音效。每次 `play()` 都
 *    `new Audio()`，旧元素只脱引用不回收（iOS 对并发媒体元素有硬上限）。
 * 2. drei 的 `<PositionalAudio autoplay>` —— 三个房间的环境音。它走
 *    `useLoader` 会 **Suspend**，于是 2.35MB 的音频挂在房间的 Suspense 边界
 *    里，8 秒加载超时很容易被它撑爆（审计 A5）；且每个实例各建一个
 *    `THREE.AudioListener`，与 `AudioProvider.isMuted` 没有任何连接——
 *    **用户静音后房间环境音照放**（A6）。
 * 3. `AchievementsContext.playUnlockChime` —— 裸 `new AudioContext()` 合成
 *    提示音。忽略静音；每次解锁新建一个 context 且从不 close（7 个成就就
 *    接近浏览器上限）；`resume()` 未 await 就检查 state，非手势触发时基本
 *    不响（C4）。
 *
 * 选 Howler 而不是「HTMLAudio 池 + 保留 three PositionalAudio」的理由见
 * ADR：后者保住了 3D 效果，但把「两套音频」这个根因留了下来。Howler 的
 * spatial 插件用 Web Audio `PannerNode`，`refDistance` / `rolloffFactor` /
 * `distanceModel` 与 `THREE.PositionalAudio` 一一对应，距离衰减效果等价。
 *
 * **状态（音量、静音）不在这里**——它在 `useAudioStore`（zustand），Mixer
 * 订阅它。这样 React 组件不再持有 `play` 函数引用，`playBgm` 进 effect 依赖
 * 数组导致「拖音量滑块 BGM 从头重放」（C2 / C6）那类问题结构性消失。
 */

export interface MixerState {
  muted: boolean
  volumes: Record<AudioBus, number>
}

const DEFAULT_VOLUMES: Record<AudioBus, number> = {
  music: 0.3,
  sfx: 0.8,
  ambience: 0.5,
}

/** 交叉淡入淡出时长 */
const FADE_MS = { music: 800, ambience: 600 } as const

interface Track {
  howl: Howl
  bus: AudioBus
  id?: number
}

export class AudioMixer {
  private howls = new Map<SoundName, Howl>()
  private music: Track | null = null
  private ambience: Track | null = null
  private state: MixerState = { muted: false, volumes: { ...DEFAULT_VOLUMES } }
  /** 自动播放被拦下时挂在这里，等第一次用户手势 */
  private pendingUnlock: (() => void) | null = null
  private unlockArmed = false

  // ── 生命周期 ────────────────────────────────────────────────────────────

  /**
   * 懒加载一个 Howl。
   *
   * **不走 React Suspense**——这是审计 A5 的修法。howler 内部用 XHR/Audio
   * 加载，加载完成前 `play()` 会排队而不是抛错，所以房间 READY 与音频彻底
   * 解耦。
   */
  private howlFor(name: SoundName): Howl {
    const existing = this.howls.get(name)
    if (existing) return existing

    const def = soundDef(name)
    const howl = new Howl({
      // howler 原生吃候选数组，按扩展名自己挑浏览器能解码的
      // ——这就是 C1（Safari 只有 .ogg 所以完全静音）的修法
      src: [...def.src],
      loop: def.loop ?? false,
      html5: false, // 用 Web Audio：spatial 与精确音量都需要它
      volume: this.busVolume(def.bus),
      preload: def.bus !== 'ambience', // 环境音进房再拉，不占首屏带宽
    })
    this.howls.set(name, howl)
    return howl
  }

  /**
   * 取一个**保证已在加载**的 Howl。
   *
   * `preload: false` 的声音需要显式 `load()`：howler 的 `play()` 在
   * `state !== 'loaded'` 时只把这次播放推进内部队列（等 `load` 事件再执行），
   * **它不会自己去拉文件**——`load()` 只在构造函数里 `preload` 为真时被调。
   * 所以环境音曾经创建了 Howl、调了 play、却永远停在 `unloaded`，一个字节
   * 都没请求，也一声没响。
   *
   * 实机复验抓到的：进 Contact 房后 `Howler._howls` 里有 amb_contact，
   * `state === 'unloaded'`、`playing() === false`，网络里没有 amb_*.m4a。
   * `__tests__/audioMixer.test.tsx` 的 fake 现在照实模拟这条语义。
   */
  private loadedHowlFor(name: SoundName): Howl {
    const howl = this.howlFor(name)
    if (howl.state() === 'unloaded') howl.load()
    return howl
  }

  private busVolume(bus: AudioBus): number {
    return this.state.muted ? 0 : this.state.volumes[bus]
  }

  // ── 状态 ────────────────────────────────────────────────────────────────

  /** 由 store 调用。Mixer 自己不持有 React 状态 */
  sync(next: MixerState): void {
    this.state = { muted: next.muted, volumes: { ...next.volumes } }
    Howler.mute(next.muted) // 真正的全局静音（A6 / C4 的修法）

    for (const [name, howl] of this.howls) {
      howl.volume(this.busVolume(soundDef(name).bus))
    }
  }

  // ── 播放 ────────────────────────────────────────────────────────────────

  /**
   * 一次性 2D 音效（门 hover / 开关门 / 撕纸 / 成就）。
   *
   * `opts.volume` 是**相对总线音量的倍数**，不是绝对值——调用方想表达的是
   * 「这一声比一般音效轻一点」（如 PaperTransition 的 0.6 / 0.8），而不是
   * 「无视用户的音量设置」。原实现把它当绝对值传给 `audio.volume`，于是
   * 用户调低 SFX 音量后这两声反而相对变大。
   */
  play(name: SoundName, opts?: { volume?: number }): number | null {
    const howl = this.loadedHowlFor(name)
    const id = howl.play()
    if (opts?.volume !== undefined) {
      const scale = Math.min(1, Math.max(0, opts.volume))
      howl.volume(this.busVolume(soundDef(name).bus) * scale, id)
    }
    this.armUnlockIfBlocked(howl, id)
    return id
  }

  /** 背景音乐。传 null 停止 */
  music_(name: SoundName | null): void {
    if (this.music && this.music.howl === (name ? this.howls.get(name) : null)) return

    const previous = this.music
    if (previous) {
      previous.howl.fade(previous.howl.volume(), 0, FADE_MS.music, previous.id)
      const { howl, id } = previous
      window.setTimeout(() => howl.stop(id), FADE_MS.music)
    }
    this.music = null
    if (!name) return

    const howl = this.loadedHowlFor(name)
    const id = howl.play()
    howl.fade(0, this.busVolume('music'), FADE_MS.music, id)
    this.music = { howl, bus: 'music', id }
    this.armUnlockIfBlocked(howl, id)
  }

  /**
   * 房间环境音，带 3D 定位。
   *
   * `position` 是世界坐标；`syncListener` 每帧把相机位姿同步给 Howler，
   * 两者一起给出与 `THREE.PositionalAudio` 等价的距离衰减。
   */
  ambience_(name: SoundName | null, position?: readonly [number, number, number]): void {
    const previous = this.ambience
    if (previous) {
      previous.howl.fade(previous.howl.volume(), 0, FADE_MS.ambience, previous.id)
      const { howl, id } = previous
      window.setTimeout(() => howl.stop(id), FADE_MS.ambience)
    }
    this.ambience = null
    if (!name) return

    const def = soundDef(name)
    const howl = this.loadedHowlFor(name)
    const id = howl.play()

    if (def.spatial && position) {
      howl.pos(position[0], position[1], position[2], id)
      howl.pannerAttr(
        {
          panningModel: 'HRTF',
          // `@types/howler` 把 distanceModel 声明为 'linear' | 'inverse'，
          // 漏了 'exponential'——但 Web Audio 规范的 DistanceModelType 是
          // 三个值，PannerNode 确实接受它。这里在边界收窄类型，而不是为了
          // 迁就一份不全的第三方声明去改运行时行为（三个房间原本就是用
          // exponential 调的，改成 inverse 会让衰减曲线变样）。
          distanceModel: def.spatial.distanceModel as 'linear' | 'inverse',
          refDistance: def.spatial.refDistance,
          rolloffFactor: def.spatial.rolloffFactor,
          maxDistance: 10000,
        },
        id,
      )
    }

    howl.fade(0, this.busVolume('ambience'), FADE_MS.ambience, id)
    this.ambience = { howl, bus: 'ambience', id }
    this.armUnlockIfBlocked(howl, id)
  }

  /** 每帧调用：把相机位姿同步给 Howler 的 listener */
  syncListener(
    position: readonly [number, number, number],
    forward: readonly [number, number, number],
    up: readonly [number, number, number],
  ): void {
    Howler.pos(position[0], position[1], position[2])
    Howler.orientation(forward[0], forward[1], forward[2], up[0], up[1], up[2])
  }

  // ── 自动播放解锁 ─────────────────────────────────────────────────────────

  /**
   * 被自动播放策略拦下时，等第一次用户手势重试。
   *
   * howler 自己有 `Howler.autoUnlock`，但它只在 iOS 的 WebAudio 解锁场景
   * 生效；桌面 Chrome 的「未交互不许播」需要显式重试——原实现只在 mount
   * 时调一次 `play()`，被拦下就静默失败且**永不重试**，直接打开 /lab 或
   * 刷新时只有碰音量滑块才会响（审计 C3）。
   */
  private armUnlockIfBlocked(howl: Howl, id: number): void {
    if (howl.playing(id)) return
    this.pendingUnlock = () => {
      if (!howl.playing(id)) howl.play(id)
    }
    this.armUnlockListener()
  }

  private armUnlockListener(): void {
    if (this.unlockArmed || typeof window === 'undefined') return
    this.unlockArmed = true

    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
      this.unlockArmed = false
      const pending = this.pendingUnlock
      this.pendingUnlock = null
      if (Howler.ctx?.state === 'suspended') void Howler.ctx.resume()
      pending?.()
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    window.addEventListener('touchstart', onGesture)
  }

  /** 离开 Lab 时清理 */
  dispose(): void {
    for (const howl of this.howls.values()) howl.unload()
    this.howls.clear()
    this.music = null
    this.ambience = null
    this.pendingUnlock = null
  }
}

/** Lab 全局单例。模块级——`/gallery` 等 Provider 之外的地方也能用 */
export const audioMixer = new AudioMixer()
