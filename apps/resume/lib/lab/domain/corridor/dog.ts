/**
 * 引路小狗的行为 reducer（ADR 20260908160918，规格 lab-companions.md §2）。
 *
 * 输入只有导轨状态、进房目标、前方最近门的墙面、动效开关与 dt；**不读相机、
 * 不读 DOM、不写任何 three 对象**。组件每帧调 `stepDog`，把快照画出来。
 *
 * 八个状态：offstage → arrive → trot / run ↔ sit ↔ idle-look；进房流程中
 * wait-at-door → greet。连续量（位置、腿相位、尾相位、头摆、前倾、小跳）与
 * 离散状态一起放在快照里，因为纸偶的核心是连续量——套状态机只剩 8 个名字。
 *
 * 不变量：**任何时刻 |x| ≥ CENTER_BAND**（视野中央禁区）。x 只取一个侧道值或
 * 门旁等待位，登场后**不换道**——所以 x 从不经过 0。`dog.test.ts` 用 2000 步
 * 随机输入断言。
 *
 * 为什么不换道：规格初稿写「走下一扇门的对侧」，实机发现门每 12 单位左右交替，
 * 狗就得每 12 单位落到相机后方换一次道——每过一扇门消失两秒。而几何上侧道
 * （x = 1.4，狗身宽 1.15 → 外缘 1.97）离墙 3.5 上的门够远，门翻板转 30° 后内缘
 * 也在 2.25 以外：狗**从不挡门**，换道解决的是一个不存在的问题。
 */

import type { WallSide } from '../ids'
import { WALL_X } from './layout'
import { DOG_STRIDE, EMPTY_STRIDE, advanceStride, type StrideState } from './footsteps'
import { clampDelta, motionOf } from './world'

export type DogState =
  | 'offstage'
  | 'arrive'
  | 'trot'
  | 'run'
  | 'sit'
  | 'idle-look'
  | 'wait-at-door'
  | 'greet'

/** 跑在玩家前方多远 */
export const DOG_LEAD = 5
/** 侧道离中线的距离 */
export const DOG_LANE_X = 1.4
/** 视野中央禁区半宽 —— 不变量 */
export const CENTER_BAND = 0.6
/** 玩家静止多久狗坐下。2.5 s 时注意力早已离开狗（UX 评审）；1.2 s */
export const SIT_AFTER_S = 1.2
/** 打招呼那一跳 */
export const GREET_S = 0.35
export const GREET_HOP = 0.15
/** 坐着时回头看一眼 */
export const LOOK_S = 0.6
export const LOOK_TILT_RAD = (12 * Math.PI) / 180
/** 登场跑进来用时 */
export const ARRIVE_S = 0.8
/** 在门旁等的位置：门前方 1.5，贴自己那侧的墙 */
export const DOOR_WAIT_OFFSET = 1.5
export const DOOR_WAIT_X = WALL_X - 1.2
/** 跑动累计多久解锁「有伴」 */
export const COMPANION_ACHIEVEMENT_S = 30
/** 跟随的指数逼近速率（每秒） */
export const FOLLOW_RATE = 6
/** 落后超过这么多就 2× 追 */
export const CATCHUP_LAG = 3
/** 跑姿前倾 */
export const RUN_LEAN_RAD = (6 * Math.PI) / 180

export interface DogInput {
  readonly camZ: number
  /** 单位/秒，负 = 前进 */
  readonly camV: number
  /** 进房流程进行中时的目标门（世界 z 与墙面）；不在流程中为 null */
  readonly doorTarget: { readonly z: number; readonly side: WallSide } | null
  /** 前方最近一扇门在哪面墙 —— 决定狗走哪条侧道 */
  readonly nextDoorSide: WallSide | null
  readonly reducedMotion: boolean
  readonly lap: number
  readonly dt: number
  /** 进房失败了（doorTarget 变回 null 但玩家从没进去）：不要"欢迎回来" */
  readonly doorAborted?: boolean
  /** 前导距离，缺省 DOG_LEAD；竖屏视锥窄，组件按宽高比把它拉远（UX 评审） */
  readonly lead?: number
}

export type DogPosture = 'side' | 'sit'

export interface DogSnapshot {
  readonly state: DogState
  readonly x: number
  readonly z: number
  /** 小跳的 y 偏移 */
  readonly hop: number
  /** 镜像：1 = 画稿原向（朝 −x，右道用），−1 = 翻面（左道用）；都朝走廊中央 */
  readonly facing: 1 | -1
  readonly posture: DogPosture
  readonly legPhase: number
  readonly tailPhase: number
  readonly headTilt: number
  readonly lean: number
  readonly stateTime: number
  readonly stillTime: number
  readonly companionTime: number
  readonly achieved: boolean
  readonly lap: number
  readonly laneTarget: number
  readonly nextLookAt: number
  /** 爪音计步（与玩家脚步共用 footsteps.ts 的计数器） */
  readonly stride: StrideState
}

export type DogEvent =
  | { readonly type: 'arrived' }
  | { readonly type: 'bark' }
  | { readonly type: 'paw' }
  | { readonly type: 'speech'; readonly key: 'dogGreet' | 'dogWait' | 'dogLap' | 'dogLapMore' }
  | { readonly type: 'achievement' }

export const INITIAL_DOG: DogSnapshot = {
  state: 'offstage',
  x: DOG_LANE_X,
  z: 0,
  hop: 0,
  facing: -1,
  posture: 'side',
  legPhase: 0,
  tailPhase: 0,
  headTilt: 0,
  lean: 0,
  stateTime: 0,
  stillTime: 0,
  companionTime: 0,
  achieved: false,
  lap: 0,
  laneTarget: DOG_LANE_X,
  nextLookAt: 7,
  stride: EMPTY_STRIDE,
}

export interface DogStep {
  readonly next: DogSnapshot
  readonly events: readonly DogEvent[]
}

/**
 * 登场时选道：第一扇门在左墙 → 走右道，反之走左道；前方没门 → 保持。
 * 只在登场那一帧用一次，之后不再换（见文件头）。
 */
export function laneFor(nextDoorSide: WallSide | null, current: number): number {
  if (nextDoorSide === 'left') return DOG_LANE_X
  if (nextDoorSide === 'right') return -DOG_LANE_X
  return current
}

/** 坐着时下一次回头的间隔：6–9 s，按位置取确定性伪随机（同一处坐两次一样） */
export function lookDelay(seed: number): number {
  const s = Number.isFinite(seed) ? Math.floor(seed) : 0
  const frac = Math.abs(Math.sin(s * 12.9898) * 43758.5453) % 1
  return 6 + 3 * frac
}

const approach = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt))

/** 画稿朝 −x。右道（x > 0）的狗要朝走廊中央 = −x = 原向；左道翻面 */
const facingFor = (x: number): 1 | -1 => (x > 0 ? 1 : -1)

export function stepDog(s: DogSnapshot, input: DogInput): DogStep {
  const dt = clampDelta(input.dt)
  if (dt <= 0 || !Number.isFinite(input.camZ)) return { next: s, events: [] }

  const events: DogEvent[] = []
  const band = motionOf(input.camV)
  const moving = band !== 'still'
  const lap = Number.isFinite(input.lap) ? Math.max(0, input.lap) : s.lap

  let n: DogSnapshot = { ...s, stateTime: s.stateTime + dt, hop: 0 }

  // ── 登场前 ────────────────────────────────────────────────────────────────
  if (s.state === 'offstage') {
    if (!moving) return { next: { ...n, lap }, events }
    const lane = laneFor(input.nextDoorSide, s.laneTarget)
    if (input.reducedMotion) {
      // reduced：直接坐在前方，此后不再移动（规格 §5）
      return {
        next: {
          ...n,
          state: 'sit',
          posture: 'sit',
          x: lane,
          z: input.camZ - DOG_LEAD,
          facing: facingFor(lane),
          laneTarget: lane,
          stateTime: 0,
          lap,
          nextLookAt: Number.POSITIVE_INFINITY,
        },
        events: [{ type: 'arrived' }],
      }
    }
    return {
      next: {
        ...n,
        state: 'arrive',
        posture: 'side',
        x: lane,
        z: input.camZ + 4,
        facing: facingFor(lane),
        laneTarget: lane,
        stateTime: 0,
        lap,
      },
      events: [{ type: 'arrived' }],
    }
  }

  /*
    reduced：不插值，但也不能消失。第一版让它坐定不动，玩家走两三秒狗就落在相机背后、
    整段路再也不出现——"减少动效"把内容拿走了（UX 评审）。掉出视野就**瞬移**到前导位：
    瞬移不是动画，阈值 6 保证只在真的看不见时跳一次。
  */
  if (input.reducedMotion) {
    if (lap > s.lap) events.push({ type: 'speech', key: lap === 1 ? 'dogLap' : 'dogLapMore' })
    const lead = input.lead ?? DOG_LEAD
    const z = Math.abs(s.z - (input.camZ - lead)) > 6 ? input.camZ - lead : s.z
    return { next: { ...n, lap, z, state: 'sit', posture: 'sit' }, events }
  }

  // ── 圈数变化：打个招呼 ────────────────────────────────────────────────────
  if (lap > s.lap && s.state !== 'arrive' && s.state !== 'greet') {
    // 第二圈是"第二圈！"，再往后就只是"又一圈！"（规格 §4）
    events.push({ type: 'speech', key: lap === 1 ? 'dogLap' : 'dogLapMore' }, { type: 'bark' })
    n = { ...n, lap, state: 'greet', posture: 'side', stateTime: 0 }
    return { next: n, events }
  }
  n = { ...n, lap }

  switch (s.state) {
    case 'arrive': {
      const target = input.camZ - DOG_LEAD
      const z = approach(s.z, target, 4 / ARRIVE_S, dt)
      const dz = Math.abs(z - s.z)
      n = {
        ...n,
        z,
        legPhase: s.legPhase + (dz * 2 * Math.PI) / DOG_STRIDE,
        tailPhase: s.tailPhase + dt * 10,
        lean: RUN_LEAN_RAD,
      }
      if (z <= target + 0.3 || n.stateTime >= ARRIVE_S * 1.5) {
        n = { ...n, state: 'trot', stateTime: 0, lean: 0 }
      }
      return { next: n, events }
    }

    case 'trot':
    case 'run': {
      if (input.doorTarget) {
        events.push({ type: 'speech', key: 'dogWait' })
        return {
          next: { ...n, state: 'wait-at-door', posture: 'side', stateTime: 0, stillTime: 0 },
          events,
        }
      }

      if (!moving) {
        const stillTime = s.stillTime + dt
        if (stillTime >= SIT_AFTER_S) {
          return {
            next: {
              ...n,
              state: 'sit',
              posture: 'sit',
              stateTime: 0,
              stillTime,
              lean: 0,
              nextLookAt: lookDelay(input.camZ),
            },
            events,
          }
        }
        n = { ...n, stillTime, lean: 0, tailPhase: s.tailPhase + dt * 3 }
        return { next: n, events }
      }

      // 等门回来后从等待位（贴墙）回到侧道
      const x = approach(s.x, s.laneTarget, FOLLOW_RATE, dt)
      const lead = input.lead ?? DOG_LEAD
      const target = input.camZ - lead

      let rate = FOLLOW_RATE
      if (band === 'run' && s.z > input.camZ - lead + CATCHUP_LAG) rate *= 2
      const z = approach(s.z, target, rate, dt)
      const dz = Math.abs(z - s.z)

      const stride = advanceStride(s.stride, z, DOG_STRIDE, true)
      if (stride.step) events.push({ type: 'paw' })

      const companionTime = s.companionTime + dt
      let achieved = s.achieved
      if (!achieved && companionTime >= COMPANION_ACHIEVEMENT_S) {
        achieved = true
        events.push({ type: 'achievement' })
      }

      n = {
        ...n,
        state: band === 'run' ? 'run' : 'trot',
        posture: 'side',
        x,
        z,
        facing: facingFor(x),
        legPhase: s.legPhase + (dz * 2 * Math.PI) / DOG_STRIDE,
        tailPhase: s.tailPhase + dt * (band === 'run' ? 10 : 6),
        lean: band === 'run' ? RUN_LEAN_RAD : 0,
        stillTime: 0,
        stride: stride.state,
        companionTime,
        achieved,
      }
      return { next: n, events }
    }

    case 'sit': {
      if (input.doorTarget) {
        events.push({ type: 'speech', key: 'dogWait' })
        return { next: { ...n, state: 'wait-at-door', posture: 'side', stateTime: 0 }, events }
      }
      if (moving) {
        return { next: { ...n, state: 'trot', posture: 'side', stateTime: 0, stillTime: 0 }, events }
      }
      n = { ...n, tailPhase: s.tailPhase + dt * 2 }
      if (n.stateTime >= s.nextLookAt) {
        return { next: { ...n, state: 'idle-look', stateTime: 0 }, events }
      }
      return { next: n, events }
    }

    case 'idle-look': {
      if (moving) {
        return {
          next: { ...n, state: 'trot', posture: 'side', headTilt: 0, stateTime: 0, stillTime: 0 },
          events,
        }
      }
      const t = Math.min(1, n.stateTime / LOOK_S)
      const headTilt = LOOK_TILT_RAD * Math.sin(Math.PI * t)
      if (n.stateTime >= LOOK_S) {
        return {
          next: { ...n, state: 'sit', headTilt: 0, stateTime: 0, nextLookAt: lookDelay(input.camZ + 1) },
          events,
        }
      }
      return { next: { ...n, headTilt }, events }
    }

    case 'wait-at-door': {
      if (!input.doorTarget) {
        // 加载失败、玩家其实没进去：回去跟跑，别"欢迎回来"（评审抓到）
        if (input.doorAborted) {
          return { next: { ...n, state: 'trot', posture: 'side', stateTime: 0, stillTime: 0 }, events }
        }
        events.push({ type: 'speech', key: 'dogGreet' }, { type: 'bark' })
        return { next: { ...n, state: 'greet', posture: 'side', stateTime: 0 }, events }
      }
      // 贴自己这一侧的墙等（不穿过中线 —— 不变量）
      const side = Math.sign(s.x) || 1
      const targetX = side * DOOR_WAIT_X
      const targetZ = input.doorTarget.z + DOOR_WAIT_OFFSET
      const x = approach(s.x, targetX, FOLLOW_RATE, dt)
      const z = approach(s.z, targetZ, FOLLOW_RATE, dt)
      const dz = Math.abs(z - s.z) + Math.abs(x - s.x)
      const arrived = Math.abs(z - targetZ) < 0.3 && Math.abs(x - targetX) < 0.2
      n = {
        ...n,
        x,
        z,
        facing: facingFor(x),
        posture: arrived ? 'sit' : 'side',
        legPhase: s.legPhase + (dz * 2 * Math.PI) / DOG_STRIDE,
        tailPhase: s.tailPhase + dt * (arrived ? 2 : 6),
        lean: 0,
      }
      return { next: n, events }
    }

    case 'greet': {
      const t = Math.min(1, n.stateTime / GREET_S)
      const hop = GREET_HOP * Math.sin(Math.PI * t)
      if (n.stateTime >= GREET_S) {
        return {
          next: { ...n, state: 'trot', posture: 'side', hop: 0, stateTime: 0, stillTime: 0 },
          events,
        }
      }
      return { next: { ...n, hop, tailPhase: s.tailPhase + dt * 12 }, events }
    }

    default:
      return { next: n, events }
  }
}
