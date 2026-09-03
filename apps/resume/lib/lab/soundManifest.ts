/**
 * Lab 音频清单 —— 路径与格式候选的唯一来源。
 *
 * 加它的原因（审计 B2 / C1 / H7）：路径原先内联在 `context/AudioContext.tsx`
 * 的 `SOUND_PATHS` 里，没有任何东西校验它与磁盘一致，于是：
 *
 * - `paper_tear` 指向 `/sounds/paper_tear.mp3`，而真实文件叫 `papersound.mp3`
 *   → 每次传送两次 404，纸撕声从未响过（Playwright 实机复现）
 * - `achievement` 指向不存在的 `/sounds/achievement.mp3`，且全仓无人调用
 * - `corridor_bg` 只有 `.ogg`。**WebKit 不支持 OGG Vorbis** → 走廊 BGM 在
 *   所有 Safari 与全部 iOS 浏览器完全静音
 *
 * 因此 `src` 是**按优先级排序的候选数组**，播放前用 `canPlayType` 选第一个
 * 浏览器支持的。`__tests__/soundManifest.test.ts` 断言每个候选文件真实存在，
 * 且每条至少有一个 WebKit 能解码的格式。
 *
 * 目标形态是 ADR 20260903140618 的 Howler 混音器（`src` 数组直接是 howler
 * 的原生入参，本文件届时迁到 `lib/lab/domain/audio/manifest.ts` 并增加
 * bus / sprite / spatial 字段）。当前是过渡形态：格式选择逻辑仍在
 * AudioContext 里手写，只有十来行。
 */

export interface SoundDef {
  /** 按优先级排序的候选源；播放时取第一个浏览器支持的格式 */
  readonly src: readonly string[]
}

export const SOUND_MANIFEST = {
  door_hover: { src: ['/sounds/door_hover.mp3'] },
  door_open: { src: ['/sounds/door_open.mp3'] },
  door_close: { src: ['/sounds/door_close.mp3'] },
  // m4a 在前：Safari / iOS 只能放这个，Chrome / Firefox 两个都能放
  corridor_bg: { src: ['/sounds/bg_corridor.m4a', '/sounds/bg_corridor.ogg'] },
  paper_tear: { src: ['/sounds/papersound.mp3'] },
} as const satisfies Record<string, SoundDef>

export type SoundName = keyof typeof SOUND_MANIFEST

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
