import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AudioBus } from '@/lib/lab/domain/audio/manifest'
import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'

/**
 * 音频偏好（ADR 20260903140616 + 20260903140618）。
 *
 * 两个变化值得说明：
 *
 * **1. 模块级 store，不是 React Context。**
 * 原先 `AudioProvider` 是 Context，于是 Provider 之外的代码拿不到音频——
 * 这正是审计 D1 那一类问题的形状（`/gallery` 独立路由在
 * `AchievementsProvider` 之外，成就永远解不开）。模块级 store 没有这个边界。
 *
 * **2. 偏好持久化交给 `persist` 中间件。**
 * 原实现有三处手写 `localStorage` 读写（音频偏好 / 成就 / 教程），各自
 * `try/catch`，各自决定脏数据怎么办。storage key 沿用 `resume_audio` 之外
 * 的三个旧 key 做一次迁移，避免老用户偏好丢失。
 */

export interface AudioStoreState {
  muted: boolean
  volumes: Record<AudioBus, number>
  toggleMute: () => void
  setVolume: (bus: AudioBus, value: number) => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))

/**
 * 从旧的三个 localStorage key 迁移。
 *
 * 老用户的偏好存在 `resume_muted` / `resume_sfx_vol` / `resume_bgm_vol`
 * 三个独立 key 里。不迁移的话他们的静音设置会在这次改动后静默重置——
 * 一个「我明明关过声音」的体验回退。
 */
function migrateLegacyPreferences(): Partial<Pick<AudioStoreState, 'muted' | 'volumes'>> {
  if (typeof window === 'undefined') return {}
  try {
    const muted = localStorage.getItem('resume_muted')
    const sfx = localStorage.getItem('resume_sfx_vol')
    const bgm = localStorage.getItem('resume_bgm_vol')
    if (muted === null && sfx === null && bgm === null) return {}

    return {
      muted: muted === 'true',
      volumes: {
        music: bgm === null ? 0.3 : clamp01(parseFloat(bgm)),
        sfx: sfx === null ? 0.8 : clamp01(parseFloat(sfx)),
        ambience: 0.5,
      },
    }
  } catch {
    return {}
  }
}

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get) => ({
      muted: false,
      volumes: { music: 0.3, sfx: 0.8, ambience: 0.5 },

      toggleMute: () => {
        set({ muted: !get().muted })
        pushToMixer()
      },

      setVolume: (bus, value) => {
        set({ volumes: { ...get().volumes, [bus]: clamp01(value) } })
        pushToMixer()
      },
    }),
    {
      name: 'resume_audio',
      // 只持久化偏好，不持久化方法
      partialize: state => ({ muted: state.muted, volumes: state.volumes }),
      merge: (persisted, current) => {
        const fromStorage = (persisted ?? {}) as Partial<AudioStoreState>
        // 首次运行（无新 key）时接管旧 key
        const legacy = fromStorage.volumes ? {} : migrateLegacyPreferences()
        return {
          ...current,
          ...fromStorage,
          ...legacy,
          volumes: { ...current.volumes, ...fromStorage.volumes, ...legacy.volumes },
        }
      },
      onRehydrateStorage: () => () => pushToMixer(),
    },
  ),
)

/**
 * 把偏好推给 Mixer。
 *
 * **Mixer 订阅 store，而不是组件持有 `play` 引用**——原先 `playBgm` 的函数
 * identity 依赖音量，而 `LabScene` 把它放进了 `useEffect` 依赖数组，于是
 * 拖一下音量滑块 BGM 就从头重放（审计 C2），`PaperTransition` 同一模式（C6）。
 * 现在音量变化只走这条路径，不改变任何回调的 identity。
 */
function pushToMixer(): void {
  const { muted, volumes } = useAudioStore.getState()
  audioMixer.sync({ muted, volumes })
}

/** 供非 React 代码（如 Mixer 初始化）读取当前偏好 */
export function currentAudioPreferences(): { muted: boolean; volumes: Record<AudioBus, number> } {
  const { muted, volumes } = useAudioStore.getState()
  return { muted, volumes }
}
