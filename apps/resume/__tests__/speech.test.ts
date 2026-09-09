import { describe, expect, it } from 'vitest'

import {
  EMPTY_SPEECH,
  SPEECH_COOLDOWN_MS,
  SPEECH_MS,
  activeSpeechFor,
  requestSpeech,
  tickSpeech,
  type SpeechState,
} from '@/lib/lab/domain/corridor/speech'

const say = (state: SpeechState, speaker: 'cat' | 'dog', priority: 1 | 2 | 3, now: number) =>
  requestSpeech(state, { speaker, key: `${speaker}-${priority}`, priority }, now)

describe('气泡规则', () => {
  describe('同时只一个', () => {
    it('第二个同级请求在第一个显示期间被丢弃，不排队', () => {
      const a = say(EMPTY_SPEECH, 'dog', 2, 1000)
      expect(a.shown).toBe(true)
      const b = say(a.state, 'cat', 2, 1200)
      expect(b.shown).toBe(false)
      expect(b.state.current?.speaker).toBe('dog')
      // 过期后也不会自动冒出被丢弃的那句
      const later = tickSpeech(b.state, 1000 + SPEECH_MS + 1)
      expect(later.current).toBeNull()
    })

    it('高优先级顶掉正在显示的低优先级', () => {
      const a = say(EMPTY_SPEECH, 'dog', 1, 1000)
      const b = say(a.state, 'cat', 3, 1200)
      expect(b.shown).toBe(true)
      expect(b.state.current?.speaker).toBe('cat')
    })

    it('低优先级顶不掉高优先级', () => {
      const a = say(EMPTY_SPEECH, 'cat', 3, 1000)
      const b = say(a.state, 'dog', 1, 1200)
      expect(b.shown).toBe(false)
    })

    it('上一句过期后新的同级请求可以显示', () => {
      const a = say(EMPTY_SPEECH, 'dog', 2, 1000)
      const b = say(a.state, 'cat', 2, 1000 + SPEECH_MS + 1)
      expect(b.shown).toBe(true)
    })
  })

  describe('冷却', () => {
    it('同一发言者在冷却内再说被拒（即便当前没有气泡）', () => {
      const a = say(EMPTY_SPEECH, 'cat', 3, 1000)
      const quiet = tickSpeech(a.state, 1000 + SPEECH_MS + 1)
      expect(quiet.current).toBeNull()
      const b = say(quiet, 'cat', 3, 1000 + SPEECH_COOLDOWN_MS.cat - 1)
      expect(b.shown).toBe(false)
      const c = say(quiet, 'cat', 3, 1000 + SPEECH_COOLDOWN_MS.cat)
      expect(c.shown).toBe(true)
    })

    it('冷却是按发言者分开的', () => {
      const a = say(EMPTY_SPEECH, 'cat', 3, 1000)
      const quiet = tickSpeech(a.state, 1000 + SPEECH_MS + 1)
      const b = say(quiet, 'dog', 2, 1000 + SPEECH_MS + 2)
      expect(b.shown).toBe(true)
    })

    it('两只活物的冷却都不短于 10 s', () => {
      expect(SPEECH_COOLDOWN_MS.cat).toBeGreaterThanOrEqual(10_000)
      expect(SPEECH_COOLDOWN_MS.dog).toBeGreaterThanOrEqual(10_000)
    })
  })

  describe('tick 与查询', () => {
    it('未过期时 tick 返回同一引用（store 不必触发更新）', () => {
      const a = say(EMPTY_SPEECH, 'dog', 2, 1000)
      expect(tickSpeech(a.state, 1500)).toBe(a.state)
    })

    it('activeSpeechFor 只返回该发言者的、且仍在显示期内的那句', () => {
      const a = say(EMPTY_SPEECH, 'dog', 2, 1000)
      expect(activeSpeechFor(a.state, 'dog', 1500)?.key).toBe('dog-2')
      expect(activeSpeechFor(a.state, 'cat', 1500)).toBeNull()
      expect(activeSpeechFor(a.state, 'dog', 1000 + SPEECH_MS + 1)).toBeNull()
    })

    it('坏的 now 不改状态', () => {
      const r = say(EMPTY_SPEECH, 'dog', 2, Number.NaN)
      expect(r.shown).toBe(false)
      expect(r.state).toBe(EMPTY_SPEECH)
    })
  })
})
