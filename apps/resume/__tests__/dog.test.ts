import { describe, expect, it } from 'vitest'

import {
  ARRIVE_S,
  CENTER_BAND,
  COMPANION_ACHIEVEMENT_S,
  DOG_LANE_X,
  DOG_LEAD,
  GREET_S,
  INITIAL_DOG,
  LOOK_S,
  SIT_AFTER_S,
  laneFor,
  lookDelay,
  stepDog,
  type DogEvent,
  type DogInput,
  type DogSnapshot,
} from '@/lib/lab/domain/corridor/dog'
import { SPEED_RUN } from '@/lib/lab/domain/corridor/world'

const DT = 1 / 60

function input(over: Partial<DogInput> = {}): DogInput {
  return {
    camZ: 28,
    camV: 0,
    doorTarget: null,
    nextDoorSide: 'left',
    reducedMotion: false,
    lap: 0,
    dt: DT,
    ...over,
  }
}

/** 连续走 n 帧，收集事件 */
function run(s: DogSnapshot, frames: number, make: (i: number) => Partial<DogInput>) {
  const events: DogEvent[] = []
  let snap = s
  for (let i = 0; i < frames; i += 1) {
    const r = stepDog(snap, input(make(i)))
    snap = r.next
    events.push(...r.events)
  }
  return { snap, events }
}

/** 从 offstage 走到 trot 的一只狗，相机在 camZ、以 v 前进中 */
function trottingDog(camZ = 28, v = -6): DogSnapshot {
  let s = INITIAL_DOG
  let z = camZ
  for (let i = 0; i < 120; i += 1) {
    z += v * DT
    s = stepDog(s, input({ camZ: z, camV: v })).next
  }
  return s
}

describe('引路小狗 reducer', () => {
  describe('登场', () => {
    it('玩家不动就一直 offstage', () => {
      const { snap } = run(INITIAL_DOG, 200, () => ({ camV: 0 }))
      expect(snap.state).toBe('offstage')
    })

    it('首次位移 → arrive，从相机后方出现，并发 arrived 事件', () => {
      const r = stepDog(INITIAL_DOG, input({ camV: -4 }))
      expect(r.next.state).toBe('arrive')
      expect(r.next.z).toBeGreaterThan(28)
      expect(r.events).toEqual([{ type: 'arrived' }])
    })

    it('约 0.8 s 内跑到前导位并转 trot', () => {
      const { snap } = run(INITIAL_DOG, Math.ceil(ARRIVE_S * 1.6 * 60), () => ({ camV: -4 }))
      expect(snap.state).toBe('trot')
      expect(snap.z).toBeLessThan(28)
    })

    it('reduced：直接坐下，此后相机走远也不动', () => {
      const first = stepDog(INITIAL_DOG, input({ camV: -4, reducedMotion: true }))
      expect(first.next.state).toBe('sit')
      const z0 = first.next.z
      const { snap } = run(first.next, 300, i => ({ camV: -6, camZ: 28 - i * 0.1, reducedMotion: true }))
      expect(snap.state).toBe('sit')
      expect(snap.z).toBe(z0)
    })
  })

  describe('跟随', () => {
    it('trot 时停在相机前方 LEAD 附近', () => {
      const v = -6
      let s = trottingDog(28, v)
      let z = s.z + DOG_LEAD // 反推当前相机位置附近
      for (let i = 0; i < 240; i += 1) {
        z += v * DT
        s = stepDog(s, input({ camZ: z, camV: v })).next
      }
      expect(Math.abs(s.z - (z - DOG_LEAD))).toBeLessThan(1.2)
    })

    it('速度过 run 阈值 → run 且前倾', () => {
      const s = trottingDog()
      const r = stepDog(s, input({ camZ: s.z + DOG_LEAD, camV: -(SPEED_RUN + 2) }))
      expect(r.next.state).toBe('run')
      expect(r.next.lean).toBeGreaterThan(0)
    })

    it('腿相位随位移推进，不随时间（原地不滑步）', () => {
      const s = trottingDog()
      const still = stepDog(s, input({ camZ: s.z + DOG_LEAD, camV: 0 }))
      expect(still.next.legPhase).toBe(s.legPhase)
    })

    it('跑动累计 30 s 解锁成就，且只发一次', () => {
      let s = trottingDog()
      const v = -3
      let z = s.z + DOG_LEAD
      const events: DogEvent[] = []
      for (let i = 0; i < Math.ceil((COMPANION_ACHIEVEMENT_S + 2) * 60); i += 1) {
        z += v * DT
        const r = stepDog(s, input({ camZ: z, camV: v }))
        s = r.next
        events.push(...r.events)
      }
      expect(events.filter(e => e.type === 'achievement')).toHaveLength(1)
      expect(events.some(e => e.type === 'paw')).toBe(true)
    })
  })

  describe('坐下与回头', () => {
    it('静止 2.5 s 后坐下，再动 1 帧就起来', () => {
      const s = trottingDog()
      const camZ = s.z + DOG_LEAD
      const { snap } = run(s, Math.ceil(SIT_AFTER_S * 60) + 2, () => ({ camZ, camV: 0 }))
      expect(snap.state).toBe('sit')
      expect(snap.posture).toBe('sit')
      const up = stepDog(snap, input({ camZ, camV: -4 }))
      expect(up.next.state).toBe('trot')
    })

    it('坐着 6–9 s 后回头一眼，0.6 s 后回到 sit', () => {
      const s = trottingDog()
      const camZ = s.z + DOG_LEAD
      let sitting = run(s, Math.ceil(SIT_AFTER_S * 60) + 2, () => ({ camZ, camV: 0 })).snap
      expect(sitting.state).toBe('sit')
      // 等到 nextLookAt
      sitting = run(sitting, Math.ceil(9.5 * 60), () => ({ camZ, camV: 0 })).snap
      // 在这 9.5 s 里一定经历了 idle-look；此刻要么在看要么已回 sit
      expect(['sit', 'idle-look']).toContain(sitting.state)
      const seen: string[] = []
      let cur = sitting
      for (let i = 0; i < Math.ceil(10 * 60); i += 1) {
        cur = stepDog(cur, input({ camZ, camV: 0 })).next
        seen.push(cur.state)
      }
      expect(seen).toContain('idle-look')
      expect(seen.filter(st => st === 'idle-look').length).toBeLessThanOrEqual(Math.ceil(LOOK_S * 60) * 2)
    })

    it('lookDelay 在 [6, 9) 且确定', () => {
      for (const seed of [0, 1, -12, 27.9, 1000]) {
        const d = lookDelay(seed)
        expect(d).toBeGreaterThanOrEqual(6)
        expect(d).toBeLessThan(9)
        expect(lookDelay(seed)).toBe(d)
      }
    })
  })

  describe('进房流程', () => {
    it('出现目标门 → wait-at-door + 一句"进这里？"；门旁等到位后坐姿', () => {
      const s = trottingDog()
      const camZ = s.z + DOG_LEAD
      const door = { z: camZ - 10, side: 'left' as const }
      const first = stepDog(s, input({ camZ, camV: -2, doorTarget: door }))
      expect(first.next.state).toBe('wait-at-door')
      expect(first.events).toEqual([{ type: 'speech', key: 'dogWait' }])
      const { snap } = run(first.next, 240, () => ({ camZ: door.z, camV: 0, doorTarget: door }))
      expect(snap.state).toBe('wait-at-door')
      expect(snap.posture).toBe('sit')
      expect(Math.abs(snap.z - (door.z + 1.5))).toBeLessThan(0.4)
    })

    it('退房（目标门消失）→ greet：一跳 + 叫 + "回来啦"，0.35 s 后回 trot', () => {
      const s = trottingDog()
      const camZ = s.z + DOG_LEAD
      const door = { z: camZ - 10, side: 'left' as const }
      const waiting = run(s, 200, () => ({ camZ: door.z, camV: 0, doorTarget: door })).snap
      const back = stepDog(waiting, input({ camZ: door.z, camV: 0, doorTarget: null }))
      expect(back.next.state).toBe('greet')
      expect(back.events).toEqual([{ type: 'speech', key: 'dogGreet' }, { type: 'bark' }])
      let hopped = false
      const { snap } = run(back.next, Math.ceil(GREET_S * 60) + 3, () => ({ camZ: door.z, camV: 0 }))
      let cur = back.next
      for (let i = 0; i < 10; i += 1) {
        cur = stepDog(cur, input({ camZ: door.z, camV: 0 })).next
        if (cur.hop > 0) hopped = true
      }
      expect(hopped).toBe(true)
      expect(snap.state).toBe('trot')
      expect(snap.hop).toBe(0)
    })
  })

  describe('圈数', () => {
    it('lap 增加 → greet 并说"第二圈"', () => {
      const s = trottingDog()
      const r = stepDog(s, input({ camZ: s.z + DOG_LEAD, camV: -4, lap: 1 }))
      expect(r.next.state).toBe('greet')
      expect(r.events).toContainEqual({ type: 'speech', key: 'dogLap' })
      expect(r.next.lap).toBe(1)
    })
  })

  describe('侧道与不变量', () => {
    it('门在左墙走右道，门在右墙走左道，前方无门保持', () => {
      expect(laneFor('left', -DOG_LANE_X)).toBe(DOG_LANE_X)
      expect(laneFor('right', DOG_LANE_X)).toBe(-DOG_LANE_X)
      expect(laneFor(null, -DOG_LANE_X)).toBe(-DOG_LANE_X)
    })

    it('登场后不换道：前方的门换到另一面墙，狗仍在原侧道（每 12 单位消失一次不可接受）', () => {
      let s = trottingDog(28, -6)
      const lane = s.x
      let z = s.z + DOG_LEAD
      for (let i = 0; i < 400; i += 1) {
        z += -6 * DT
        s = stepDog(s, input({ camZ: z, camV: -6, nextDoorSide: i % 100 < 50 ? 'right' : 'left' })).next
        expect(Math.sign(s.x)).toBe(Math.sign(lane))
        expect(s.z).toBeLessThan(z) // 一直在相机前方
      }
    })

    it('从门旁等待位回到侧道是渐进的，且始终在同一侧', () => {
      const s = trottingDog()
      const camZ = s.z + DOG_LEAD
      const door = { z: camZ - 10, side: 'left' as const }
      const waiting = run(s, 200, () => ({ camZ: door.z, camV: 0, doorTarget: door })).snap
      expect(Math.abs(waiting.x)).toBeGreaterThan(DOG_LANE_X) // 贴墙
      let cur = stepDog(waiting, input({ camZ: door.z, camV: 0, doorTarget: null })).next
      for (let i = 0; i < 120; i += 1) {
        cur = stepDog(cur, input({ camZ: door.z - i * 0.1, camV: -6 })).next
        expect(Math.sign(cur.x)).toBe(Math.sign(waiting.x))
      }
      expect(Math.abs(cur.x - Math.sign(cur.x) * DOG_LANE_X)).toBeLessThan(0.2)
    })

    it('2000 步随机输入：任何时刻 |x| ≥ 0.6，且所有量有限', () => {
      let seed = 7
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296
        return seed / 4294967296
      }
      let s = INITIAL_DOG
      let camZ = 28
      let camV = 0
      let door: DogInput['doorTarget'] = null
      let side: DogInput['nextDoorSide'] = 'left'
      let lap = 0
      for (let i = 0; i < 2000; i += 1) {
        if (rnd() < 0.05) camV = (rnd() - 0.6) * 40
        if (rnd() < 0.02) camV = 0
        camZ += camV * DT
        if (rnd() < 0.01) door = door ? null : { z: camZ - 8, side: rnd() < 0.5 ? 'left' : 'right' }
        if (rnd() < 0.03) side = rnd() < 0.45 ? 'left' : rnd() < 0.9 ? 'right' : null
        if (rnd() < 0.002) lap += 1
        const dt = rnd() < 0.1 ? 0.2 : DT // 偶尔一帧很长（切标签页回来）
        s = stepDog(s, input({ camZ, camV, doorTarget: door, nextDoorSide: side, lap, dt })).next
        if (s.state !== 'offstage') {
          expect(Math.abs(s.x), `第 ${i} 步 x=${s.x} state=${s.state}`).toBeGreaterThanOrEqual(CENTER_BAND)
        }
        for (const v of [s.x, s.z, s.hop, s.legPhase, s.tailPhase, s.headTilt, s.lean]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    })
  })

  describe('坏输入', () => {
    it('dt ≤ 0 或 camZ 非有限 → 原状', () => {
      expect(stepDog(INITIAL_DOG, input({ dt: 0 })).next).toBe(INITIAL_DOG)
      expect(stepDog(INITIAL_DOG, input({ camZ: Number.NaN })).next).toBe(INITIAL_DOG)
    })

    it('大 dt 被夹到 0.05', () => {
      const s = trottingDog()
      const r = stepDog(s, input({ camZ: s.z + DOG_LEAD, camV: -4, dt: 5 }))
      expect(r.next.stateTime - s.stateTime).toBeCloseTo(0.05, 5)
    })
  })
})
