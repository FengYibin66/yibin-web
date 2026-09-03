/**
 * Lab 音频清单 —— 路径、格式候选与总线的唯一来源。
 *
 * 由 `lib/lab/soundManifest.ts` 迁入并扩展（ADR 20260903140615 的分层 +
 * ADR 20260903140618 的 Howler 混音器）。新增 `bus` 与 `spatial` 两组字段，
 * 它们直接对应 howler 的入参。
 *
 * 已由这份清单修掉的三个故障：
 *
 * - `paper_tear` 曾指向不存在的 `/sounds/paper_tear.mp3`（真实文件叫
 *   `papersound.mp3`）→ 每次传送两次 404，纸撕声从未响过
 * - `achievement` 指向不存在的文件，且全仓无人调用
 * - `corridor_bg` 曾只有 `.ogg`。**WebKit 不支持 OGG Vorbis** → 走廊 BGM
 *   在所有 Safari 与全部 iOS 浏览器完全静音
 *
 * `__tests__/soundManifest.test.ts` 断言每个候选文件真实存在，且每条至少有
 * 一个 WebKit 能解码的格式。
 */

/** 三条总线各有独立音量；`Howler.mute()` 作用于全部 */
export const AUDIO_BUSES = ['music', 'sfx', 'ambience'] as const
export type AudioBus = (typeof AUDIO_BUSES)[number]

export interface SpatialConfig {
  /** 到该距离后开始衰减 */
  refDistance: number
  /** 衰减速率 */
  rolloffFactor: number
  distanceModel: 'linear' | 'inverse' | 'exponential'
}

export interface SoundDef {
  /**
   * 按优先级排序的候选源。
   * 播放前用 `canPlayType` 选第一个浏览器支持的；howler 原生吃这个数组。
   */
  readonly src: readonly string[]
  readonly bus: AudioBus
  readonly loop?: boolean
  /** 同名音效的并发上限（门 hover 会高频触发） */
  readonly pool?: number
  /** 声明后走 3D 定位（PannerNode），保留距离衰减 */
  readonly spatial?: SpatialConfig
}

export const SOUND_MANIFEST = {
  // ── 走廊 BGM ──
  // m4a 在前：Safari / iOS 只能放这个，Chrome / Firefox 两个都能放
  corridor_bg: {
    src: ['/sounds/bg_corridor.m4a', '/sounds/bg_corridor.ogg'],
    bus: 'music',
    loop: true,
  },

  // ── 2D 音效 ──
  door_hover: { src: ['/sounds/door_hover.mp3'], bus: 'sfx', pool: 4 },
  door_open: { src: ['/sounds/door_open.mp3'], bus: 'sfx', pool: 2 },
  door_close: { src: ['/sounds/door_close.mp3'], bus: 'sfx', pool: 2 },
  paper_tear: { src: ['/sounds/papersound.mp3'], bus: 'sfx', pool: 2 },
  // 成就解锁的双音（A4 → E5，0.56s）。ffmpeg 合成，8KB。
  // 原实现是裸 AudioContext 现场合成同一组音——那条路径忽略静音、泄漏
  // AudioContext、且非手势触发时基本不响（审计 C4）。做成音频文件后它和
  // 其余音效走同一条总线。生成命令见 scripts/media/encode-audio.mjs 顶部。
  achievement_chime: { src: ['/sounds/achievement_chime.m4a'], bus: 'sfx', pool: 1 },

  // ── 房间环境音（3D 定位，由 RoomDefinition.ambience 引用）──
  // 这三段原先经 drei 的 <PositionalAudio> 播放，那层包装走 useLoader 会
  // Suspend，于是它们**阻塞房间 READY**（审计 A5），且各自建一个
  // AudioListener 与全局静音断开（A6）。
  // 单声道 64kbps m4a（scripts/media/encode-audio.mjs 生成）。
  // 原始 mp3 是 320kbps 立体声，四段共 6.8MB → 1.7MB。
  // 单声道不损失 3D 效果：定位由 PannerNode 做，源本身是不是立体声无关。
  amb_about: {
    src: ['/sounds/amb_about.m4a'],
    bus: 'ambience',
    loop: true,
    spatial: { refDistance: 2, rolloffFactor: 0.8, distanceModel: 'exponential' },
  },
  amb_projects: {
    src: ['/sounds/amb_projects.m4a'],
    bus: 'ambience',
    loop: true,
    spatial: { refDistance: 2, rolloffFactor: 1.0, distanceModel: 'exponential' },
  },
  amb_contact: {
    src: ['/sounds/amb_contact.m4a'],
    bus: 'ambience',
    loop: true,
    spatial: { refDistance: 2, rolloffFactor: 1.2, distanceModel: 'exponential' },
  },
  amb_publications: {
    src: ['/sounds/amb_publications.m4a'],
    bus: 'ambience',
    loop: true,
    spatial: { refDistance: 3, rolloffFactor: 1.0, distanceModel: 'exponential' },
  },
} as const satisfies Record<string, SoundDef>

export type SoundName = keyof typeof SOUND_MANIFEST

/**
 * 按名字取定义，类型是 `SoundDef` 而不是字面量。
 *
 * 需要它是因为 `as const satisfies` 会把每一项窄化成它自己的字面量类型，
 * 于是 `SOUND_MANIFEST[name].spatial` 在联合类型上不可访问——只有声明了
 * spatial 的那几项有这个字段。`as const` 的好处（key 是字面量联合、
 * 值不可变）要保留，所以在这里做一次收窄到公共接口。
 */
export function soundDef(name: SoundName): SoundDef {
  return SOUND_MANIFEST[name] as SoundDef
}

/** MIME 类型：`canPlayType` 需要它来判断能否解码 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg; codecs="vorbis"',
  '.wav': 'audio/wav',
}

function mimeFor(src: string): string | null {
  const dot = src.lastIndexOf('.')
  return dot === -1 ? null : (MIME_BY_EXTENSION[src.slice(dot).toLowerCase()] ?? null)
}

/**
 * 挑一个当前浏览器能放的源。
 *
 * `canPlayType` 返回 `''`（不支持）/ `'maybe'` / `'probably'`。只排除明确的
 * `''`——`'maybe'` 在实践中都能放，而过度挑剔会让有些浏览器一个候选都不剩。
 * 全部候选都被拒时返回第一个：让浏览器自己去失败，好过静默不播。
 */
export function pickPlayableSource(
  name: SoundName,
  probe: (mime: string) => CanPlayTypeResult,
): string {
  const { src } = SOUND_MANIFEST[name]
  for (const candidate of src) {
    const mime = mimeFor(candidate)
    if (mime === null || probe(mime) !== '') return candidate
  }
  return src[0]!
}

/** 清单里出现的全部音频文件（供资源校验用） */
export function allSoundSources(): string[] {
  return [...new Set(Object.values(SOUND_MANIFEST).flatMap(def => [...def.src]))]
}
