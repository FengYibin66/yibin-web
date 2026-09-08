/**
 * 气泡的持有者：规则在 domain（`corridor/speech.ts`），这里只管时间与副作用。
 *
 * 为什么是独立的小 store 而不是塞进 `corridorStore`：气泡不是走廊世界的状态
 * （不进记忆、不影响显形、换段也不变），它是三个发言者共用的一个"话筒"。
 * 放一起只会让世界状态多一个与位置无关的字段。
 *
 * 到点清掉那句话用 `setTimeout` 而不是每帧 tick：气泡一次显示 1.8 s，
 * 为它每帧跑一次 selector 不值。
 */
import { create } from 'zustand'

import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import {
  EMPTY_SPEECH,
  requestSpeech,
  tickSpeech,
  type SpeechRequest,
  type SpeechState,
} from '@/lib/lab/domain/corridor/speech'

interface SpeechStoreState {
  speech: SpeechState
  /** 试着说一句；被规则拒了返回 false（调用方不需要关心为什么） */
  say: (req: SpeechRequest) => boolean
  /** 测试 / 卸载用 */
  reset: () => void
}

let expiry: ReturnType<typeof setTimeout> | null = null

export const useSpeechStore = create<SpeechStoreState>()((set, get) => ({
  speech: EMPTY_SPEECH,

  say: req => {
    const now = Date.now()
    const { state, shown } = requestSpeech(get().speech, req, now)
    if (!shown) return false
    set({ speech: state })

    // 气泡冒出来那一下（ADR 20260908204304）；静音由混音器统一管
    audioMixer.play('bubble_pop', { volume: 0.4 })

    if (expiry) clearTimeout(expiry)
    const until = state.current?.until ?? now
    expiry = setTimeout(() => {
      expiry = null
      const cur = get().speech
      const next = tickSpeech(cur, Date.now())
      if (next !== cur) set({ speech: next })
    }, Math.max(0, until - now) + 10)
    return true
  },

  reset: () => {
    if (expiry) clearTimeout(expiry)
    expiry = null
    set({ speech: EMPTY_SPEECH })
  },
}))

/** 组件外（reducer 事件处理）也能说 */
export function say(req: SpeechRequest): boolean {
  return useSpeechStore.getState().say(req)
}
