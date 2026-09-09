#!/usr/bin/env node
/**
 * 活物与脚步的音效：离线合成（ADR 20260908204304）。
 *
 * 纯 Node、零依赖，直接写 44.1 kHz 单声道 16-bit WAV 到 `media-src/sounds/synth/`，
 * 再由 `encode-audio.mjs` 编成 m4a + ogg 进 `public/sounds/`。
 *
 * 风格刻意是**卡通短音**——纸世界里一只真狗的叫声会像贴错的贴纸。
 * 参数全部写死、噪声用固定种子，重跑逐字节一致（指纹只含本脚本）。
 *
 * 七个文件（参数见规格 lab-corridor-story.md §6）：
 *   footstep_a / footstep_b   玩家脚步：60 ms 低通噪声脉冲，两个变体截止频率差 15%
 *   paw_a / paw_b             狗爪：35 ms、更亮、更轻
 *   dog_bark                  两段 90 ms 的 FM 短音（520 → 380 Hz，调制 40 Hz），间隔 70 ms
 *   cat_meow                  450 ms 锯齿波 620 → 780 → 540 Hz 滑音 + 6 Hz 颤音，低通 2.4 kHz
 *   bubble_pop                25 ms 正弦 1.6 kHz 快速衰减
 *
 * 用法：
 *   node scripts/media/synth-sounds.mjs            生成
 *   node scripts/media/synth-sounds.mjs --check    只报告
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkFresh, digestOf, writeStamp } from './freshness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../media-src/sounds/synth')
const SR = 44_100

const NAMES = ['footstep_a', 'footstep_b', 'paw_a', 'paw_b', 'dog_bark', 'cat_meow', 'bubble_pop']
const STAMP_NAME = 'synth-sounds'
const stampInputs = [fileURLToPath(import.meta.url)]
const stampOutputs = NAMES.map(n => join(OUT, `${n}.wav`))

if (process.argv.includes('--check')) {
  const { fresh, reason } = checkFresh(STAMP_NAME, stampInputs, stampOutputs)
  console.log(`  ${fresh ? '·' : '!'} 合成音效  ${reason}`)
  console.log(fresh ? '\n[同步] 合成音效已是最新' : '\n[待处理] 跑 node scripts/media/synth-sounds.mjs')
  process.exit(fresh ? 0 : 1)
}

// ── 合成原语 ──────────────────────────────────────────────────────────────────

/** 固定种子的 LCG；不用 Math.random，产物要可复现 */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296 * 2 - 1
  }
}

const samples = (seconds) => Math.round(seconds * SR)

/** 一阶低通（RC）；cutoff 可以是数或 (i) => Hz 的函数 */
function lowpass(buf, cutoff) {
  let y = 0
  const out = new Float64Array(buf.length)
  for (let i = 0; i < buf.length; i += 1) {
    const fc = typeof cutoff === 'function' ? cutoff(i) : cutoff
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR)
    y += a * (buf[i] - y)
    out[i] = y
  }
  return out
}

/** 攻 / 衰 / 释 包络（秒），中间保持 1 */
function envelope(n, attack, release, decayTo = 1) {
  const env = new Float64Array(n)
  const a = samples(attack)
  const r = samples(release)
  for (let i = 0; i < n; i += 1) {
    let v = 1
    if (i < a) v = i / a
    else if (i >= n - r) v = (n - i) / r
    // 攻后到释前线性衰到 decayTo
    const mid = Math.min(1, Math.max(0, (i - a) / Math.max(1, n - a - r)))
    env[i] = v * (1 - mid * (1 - decayTo))
  }
  return env
}

const mul = (a, b) => a.map((v, i) => v * b[i])

/** 频率轨迹：分段线性经过 [t, hz] 点 */
function glide(points) {
  return (i) => {
    const t = i / SR
    for (let k = 1; k < points.length; k += 1) {
      const [t0, f0] = points[k - 1]
      const [t1, f1] = points[k]
      if (t <= t1) return f0 + ((f1 - f0) * (t - t0)) / Math.max(1e-6, t1 - t0)
    }
    return points[points.length - 1][1]
  }
}

/** 相位累积的振荡器；wave: 'sine' | 'saw'；vibrato 可选 {hz, depth} */
function osc(n, freqAt, wave, vibrato) {
  const out = new Float64Array(n)
  let phase = 0
  for (let i = 0; i < n; i += 1) {
    let f = freqAt(i)
    if (vibrato) f *= 1 + vibrato.depth * Math.sin((2 * Math.PI * vibrato.hz * i) / SR)
    phase += f / SR
    const p = phase % 1
    out[i] = wave === 'saw' ? 2 * p - 1 : Math.sin(2 * Math.PI * p)
  }
  return out
}

function noise(n, seed) {
  const r = rng(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i += 1) out[i] = r()
  return out
}

function silence(seconds) {
  return new Float64Array(samples(seconds))
}

function concat(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Float64Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** 归一化到 peak，再乘增益 */
function normalize(buf, gain) {
  let peak = 0
  for (const v of buf) peak = Math.max(peak, Math.abs(v))
  const k = peak > 0 ? gain / peak : 0
  return buf.map(v => v * k)
}

function toWav(buf) {
  const n = buf.length
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-1, Math.min(1, buf[i]))
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(SR * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

// ── 七个音 ────────────────────────────────────────────────────────────────────

/** 脚步：低通噪声脉冲，前 8 ms 攻、其余衰。b 的截止比 a 高 15% */
function footstep(cutoff, seed) {
  const n = samples(0.06)
  const body = lowpass(noise(n, seed), cutoff)
  return normalize(mul(body, envelope(n, 0.004, 0.04, 0.2)), 0.9)
}

/** 狗爪：更短、更亮、更轻 */
function paw(cutoff, seed) {
  const n = samples(0.035)
  const body = lowpass(noise(n, seed), cutoff)
  return normalize(mul(body, envelope(n, 0.002, 0.025, 0.15)), 0.6)
}

/** 狗叫：两段 FM 短音 */
function bark() {
  const one = () => {
    const n = samples(0.09)
    const carrier = osc(n, glide([[0, 520], [0.09, 380]]), 'sine', { hz: 40, depth: 0.12 })
    // 加一点锯齿谐波让它"有喉音"
    const grit = osc(n, glide([[0, 520], [0.09, 380]]), 'saw')
    const mixed = carrier.map((v, i) => v * 0.75 + grit[i] * 0.25)
    return mul(lowpass(mixed, 1800), envelope(n, 0.006, 0.03, 0.5))
  }
  return normalize(concat(one(), silence(0.07), one()), 0.85)
}

/** 猫叫：滑音锯齿 + 颤音 */
function meow() {
  const n = samples(0.45)
  const tone = osc(n, glide([[0, 620], [0.14, 780], [0.45, 540]]), 'saw', { hz: 6, depth: 0.025 })
  const soft = lowpass(tone, 2400)
  return normalize(mul(soft, envelope(n, 0.04, 0.16, 0.55)), 0.7)
}

/** 气泡冒出：一声极短的高频噼 */
function pop() {
  const n = samples(0.025)
  const tone = osc(n, glide([[0, 1600], [0.025, 1200]]), 'sine')
  return normalize(mul(tone, envelope(n, 0.001, 0.02, 0.1)), 0.5)
}

const SOUNDS = {
  footstep_a: footstep(900, 11),
  footstep_b: footstep(900 * 1.15, 23),
  paw_a: paw(1800, 37),
  paw_b: paw(1800 * 1.15, 41),
  dog_bark: bark(),
  cat_meow: meow(),
  bubble_pop: pop(),
}

mkdirSync(OUT, { recursive: true })
for (const name of NAMES) {
  const wav = toWav(SOUNDS[name])
  writeFileSync(join(OUT, `${name}.wav`), wav)
  console.log(`  ✓ ${name.padEnd(12)} ${(SOUNDS[name].length / SR * 1000).toFixed(0).padStart(4)} ms  ${Math.round(wav.length / 1024)} KB`)
}
writeStamp(STAMP_NAME, digestOf(stampInputs), stampOutputs)
console.log(`\n${NAMES.length} 个 → media-src/sounds/synth/（再跑 encode-audio.mjs 出 m4a/ogg）`)
