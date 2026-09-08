/**
 * 按**位移**触发的脚步（ADR 20260908204304）。
 *
 * 不按时间：滚轮 / 键盘 / 触摸走同一条路径（与"开始探索"的判定同一理由，
 * 见 `exploration.ts`），而且导轨是指数插值——按时间响会在相机已经停下、
 * 插值尾巴还在挪的那一秒里多响两步。
 *
 * 玩家（步距 1.8）与狗（步距 0.9）共用同一个计数器。
 */

import { motionOf, type MotionBand } from './world'

export interface StrideState {
  /** 自上一步以来累计的位移 */
  readonly accum: number
  readonly lastZ: number | null
  readonly next: 'a' | 'b'
}

export const EMPTY_STRIDE: StrideState = { accum: 0, lastZ: null, next: 'a' }

/** 玩家两步之间的位移 */
export const PLAYER_STRIDE = 1.8
/** 狗两声爪音之间的位移 */
export const DOG_STRIDE = 0.9

/** 走 / 跑两档的音量（相对总线） */
export const FOOTSTEP_VOLUME: Readonly<Record<Exclude<MotionBand, 'still'>, number>> = {
  walk: 0.5,
  run: 0.8,
}

export interface StrideResult {
  readonly state: StrideState
  /** 这一帧该响一步的话是 a 还是 b */
  readonly step: 'a' | 'b' | null
}

/**
 * 推进计数器。`active` 为 false（静止 / 不在走廊）时只跟踪位置、不累计——
 * 否则在房间里传送一下回来会先"补"几步。
 */
export function advanceStride(
  state: StrideState,
  z: number,
  stride: number,
  active: boolean,
): StrideResult {
  if (!Number.isFinite(z)) return { state, step: null }
  if (state.lastZ === null || !active) {
    return { state: { accum: 0, lastZ: z, next: state.next }, step: null }
  }
  const accum = state.accum + Math.abs(z - state.lastZ)
  if (accum < stride) return { state: { accum, lastZ: z, next: state.next }, step: null }
  return {
    state: { accum: accum - stride, lastZ: z, next: state.next === 'a' ? 'b' : 'a' },
    step: state.next,
  }
}

export interface PlayerStep {
  readonly variant: 'a' | 'b'
  readonly volume: number
}

/** 玩家脚步：由导轨的 z 与速度决定响不响、响多大 */
export function playerFootstep(
  state: StrideState,
  z: number,
  velocity: number,
  inCorridor: boolean,
): { state: StrideState; step: PlayerStep | null } {
  const band = motionOf(velocity)
  const active = inCorridor && band !== 'still'
  const r = advanceStride(state, z, PLAYER_STRIDE, active)
  if (r.step === null || band === 'still') return { state: r.state, step: null }
  return { state: r.state, step: { variant: r.step, volume: FOOTSTEP_VOLUME[band] } }
}
