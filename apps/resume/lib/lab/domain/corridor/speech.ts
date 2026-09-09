/**
 * 一行字气泡的规则（架构文档 §7，ADR 20260908160918）。
 *
 * 发言者：狗、猫（头像的闲聊在规格里有、没有实现——不预留没人用的枚举值）。三条规则全是纯函数：
 *
 * 1. **同时只一个气泡**——两个活物同时冒字，读者一个也读不完。
 * 2. **每个发言者有冷却**——猫被连点十次不该喵十次（成就照解，字只冒一次）。
 * 3. **优先级**：用户触发（点猫）> 状态变化（狗到门口）> 闲聊（预留给将来的闲话）。
 *    高优先级可以顶掉正在显示的低优先级；反之被丢弃，不排队——排队的字会在
 *    读者已经走远之后才冒出来。
 *
 * 文案不在这里：这里只传**键**（`labUi.companions.<key>`），渲染层按语言取字。
 */

export type Speaker = 'cat' | 'dog'

/** 1 闲聊 · 2 状态变化 · 3 用户触发 */
export type SpeechPriority = 1 | 2 | 3

export interface SpeechRequest {
  readonly speaker: Speaker
  readonly key: string
  readonly priority: SpeechPriority
  /** 缺省 SPEECH_MS */
  readonly durationMs?: number
}

export interface ActiveSpeech {
  readonly speaker: Speaker
  readonly key: string
  readonly priority: SpeechPriority
  readonly since: number
  readonly until: number
}

export interface SpeechState {
  readonly current: ActiveSpeech | null
  readonly lastSpokenAt: Readonly<Partial<Record<Speaker, number>>>
}

export const EMPTY_SPEECH: SpeechState = { current: null, lastSpokenAt: {} }

/** 一句话显示多久 */
export const SPEECH_MS = 1800

/** 同一发言者两句之间的最短间隔 */
export const SPEECH_COOLDOWN_MS: Readonly<Record<Speaker, number>> = {
  cat: 10_000,
  dog: 10_000,
}

export interface SpeechResult {
  readonly state: SpeechState
  readonly shown: boolean
}

export function requestSpeech(state: SpeechState, req: SpeechRequest, now: number): SpeechResult {
  if (!Number.isFinite(now)) return { state, shown: false }

  const last = state.lastSpokenAt[req.speaker]
  if (last !== undefined && now - last < SPEECH_COOLDOWN_MS[req.speaker]) {
    return { state, shown: false }
  }

  const live = state.current !== null && state.current.until > now ? state.current : null
  if (live && live.priority >= req.priority) {
    return { state, shown: false }
  }

  const duration = req.durationMs ?? SPEECH_MS
  return {
    shown: true,
    state: {
      current: {
        speaker: req.speaker,
        key: req.key,
        priority: req.priority,
        since: now,
        until: now + duration,
      },
      lastSpokenAt: { ...state.lastSpokenAt, [req.speaker]: now },
    },
  }
}

/** 到点清掉过期的那句。没过期时返回原对象（引用相等，方便 store 判变化） */
export function tickSpeech(state: SpeechState, now: number): SpeechState {
  if (state.current === null) return state
  if (!Number.isFinite(now) || state.current.until > now) return state
  return { ...state, current: null }
}

export function activeSpeechFor(state: SpeechState, speaker: Speaker, now: number): ActiveSpeech | null {
  const cur = state.current
  if (cur === null || cur.speaker !== speaker) return null
  return cur.until > now ? cur : null
}
