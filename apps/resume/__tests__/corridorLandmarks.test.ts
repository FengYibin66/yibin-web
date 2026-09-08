import { describe, expect, it } from 'vitest'

import {
  CORRIDOR_LANDMARKS,
  landmarkById,
  landmarksInSegment,
  muralKeepOuts,
  visitTargets,
  inkableLandmarkIds,
  type Landmark,
} from '@/lib/lab/domain/corridor/landmarks'
import {
  CORRIDOR_DOORS,
  CORRIDOR_FURNITURE,
  BUG_RELATIVE_Z,
  HERO_RELATIVE_Z,
  SEGMENT_DOOR_RELATIVE_Z,
  SEGMENT_LENGTH,
} from '@/lib/lab/domain/corridor/layout'
import { MURAL_KEEP_OUTS } from '@/lib/lab/corridorMurals'
import { landmarkSchema } from '@/lib/lab/domain/schema'
import { ROOM_IDS } from '@/lib/lab/domain/ids'

/**
 * 地标表的门禁（ADR 20260908172231）。
 *
 * 这张表是走廊里**一切有位置的东西**的唯一来源：门、家具、欢迎区、彩蛋、段末门，
 * 将来还有窗与年份刻度。它取代的是散在四处的常量（`CORRIDOR_DOORS` /
 * `CORRIDOR_FURNITURE` / `HERO_RELATIVE_Z` / `BUG_RELATIVE_Z`）与**第五处**
 * ——`lib/lab/corridorMurals.ts` 的 `MURAL_KEEP_OUTS`，那份是壁画避让用的
 * 第二套坐标真相，`layout.ts` 头部把它登记为「暂未迁入」已久。
 *
 * 所以本文件最重要的一条是「派生等价」那一组：`muralKeepOuts()` 必须与手写的
 * `MURAL_KEEP_OUTS` **逐项相等**。它证明这次重构没有挪动任何一块壁画——
 * 而壁画位置的变化在单测里看不见，只会在实机截图上表现为"画压在门上"。
 */
describe('走廊地标表', () => {
  describe('schema', () => {
    it.each(CORRIDOR_LANDMARKS.map(l => [l.id, l] as const))(
      '%s 过 schema',
      (_id, landmark) => {
        expect(() => landmarkSchema.parse(landmark)).not.toThrow()
      },
    )

    it('id 唯一', () => {
      const ids = CORRIDOR_LANDMARKS.map(l => l.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('relativeZ 都在段内（负数、不超过段长）', () => {
      for (const l of CORRIDOR_LANDMARKS) {
        expect(l.relativeZ).toBeLessThan(0)
        expect(l.relativeZ).toBeGreaterThan(-SEGMENT_LENGTH)
      }
    })
  })

  describe('与既有常量一致（重构不改坐标）', () => {
    it('门：slot / roomId / relativeZ / side / textureType 与 CORRIDOR_DOORS 逐项相同', () => {
      const doors = CORRIDOR_LANDMARKS.filter(
        (l): l is Extract<Landmark, { kind: 'door' }> => l.kind === 'door',
      )
      expect(doors).toHaveLength(CORRIDOR_DOORS.length)
      for (const expected of CORRIDOR_DOORS) {
        const actual = doors.find(d => d.roomId === expected.roomId)
        expect(actual, `房间 ${expected.roomId} 没有对应地标`).toBeDefined()
        expect(actual!.slot).toBe(expected.slot)
        expect(actual!.relativeZ).toBe(expected.relativeZ)
        expect(actual!.side).toBe(expected.side)
        expect(actual!.textureType).toBe(expected.textureType)
      }
    })

    it('每个房间都有一扇门', () => {
      const roomIds = CORRIDOR_LANDMARKS.filter(l => l.kind === 'door').map(
        l => (l as Extract<Landmark, { kind: 'door' }>).roomId,
      )
      expect([...roomIds].sort()).toEqual([...ROOM_IDS].sort())
    })

    it('家具：kind / relativeZ / side 与 CORRIDOR_FURNITURE 逐项相同', () => {
      const furniture = CORRIDOR_LANDMARKS.filter(
        (l): l is Extract<Landmark, { kind: 'furniture' }> => l.kind === 'furniture',
      )
      expect(furniture).toHaveLength(CORRIDOR_FURNITURE.length)
      for (const expected of CORRIDOR_FURNITURE) {
        const actual = furniture.find(f => f.variant === expected.kind)
        expect(actual, `家具 ${expected.kind} 没有对应地标`).toBeDefined()
        expect(actual!.relativeZ).toBe(expected.relativeZ)
        expect(actual!.side).toBe(expected.side)
      }
    })

    it('欢迎区 / 彩蛋 / 段末门的 z 与既有常量相同', () => {
      expect(landmarkById('welcome-avatar')?.relativeZ).toBe(HERO_RELATIVE_Z)
      expect(landmarkById('bug')?.relativeZ).toBe(BUG_RELATIVE_Z)
      expect(landmarkById('segment-door')?.relativeZ).toBe(SEGMENT_DOOR_RELATIVE_Z)
    })
  })

  describe('壁画避让由地标派生（等价性）', () => {
    it('muralKeepOuts() 与手写的 MURAL_KEEP_OUTS 逐项相等', () => {
      const derived = [...muralKeepOuts()]
        .map(k => ({ side: k.side, z: k.z, radius: k.radius, reason: k.reason }))
        .sort((a, b) => a.reason.localeCompare(b.reason))
      const handwritten = [...MURAL_KEEP_OUTS]
        .map(k => ({ side: k.side, z: k.z, radius: k.radius, reason: k.reason }))
        .sort((a, b) => a.reason.localeCompare(b.reason))
      expect(derived).toEqual(handwritten)
    })

    it('每个 keep-out 都指向一个真实地标（不存在孤儿避让区）', () => {
      for (const keepOut of muralKeepOuts()) {
        expect(landmarkById(keepOut.reason), `避让区 ${keepOut.reason} 没有对应地标`).toBeDefined()
      }
    })
  })

  describe('派生查询', () => {
    it('landmarksInSegment(0) 含全部地标', () => {
      const ids = landmarksInSegment(0).map(l => l.id)
      expect(new Set(ids)).toEqual(new Set(CORRIDOR_LANDMARKS.map(l => l.id)))
    })

    it('segments 限定为第 0 段的地标不出现在第 1 段', () => {
      const firstOnly = CORRIDOR_LANDMARKS.filter(
        l => l.segments !== 'all' && !l.segments.includes(1),
      )
      const inSegmentOne = new Set(landmarksInSegment(1).map(l => l.id))
      for (const l of firstOnly) {
        expect(inSegmentOne.has(l.id), `${l.id} 不该出现在第 1 段`).toBe(false)
      }
    })

    it('landmarkById 未知 id 返回 undefined，不抛', () => {
      expect(landmarkById('no-such-landmark')).toBeUndefined()
    })

    it('visitTargets() 只含声明了 visitRadius 的地标，且半径为正', () => {
      for (const l of visitTargets()) {
        expect(l.visitRadius).toBeGreaterThan(0)
      }
      const withRadius = CORRIDOR_LANDMARKS.filter(l => (l.visitRadius ?? 0) > 0)
      expect(visitTargets()).toHaveLength(withRadius.length)
    })

    it('inkableLandmarkIds() 只含 inkable 地标；五扇门都在其中', () => {
      const inkable = new Set(inkableLandmarkIds())
      for (const id of inkable) {
        expect(landmarkById(id)?.inkable).toBe(true)
      }
      for (const door of CORRIDOR_DOORS) {
        expect(inkable.has(`door-${door.roomId}`), `door-${door.roomId} 应可显形`).toBe(true)
      }
    })
  })

  describe('几何约束', () => {
    it('同一侧的门两两间距 ≥ 4（门龛宽度）', () => {
      for (const side of ['left', 'right'] as const) {
        const zs = CORRIDOR_LANDMARKS.filter(
          l => l.kind === 'door' && (l as Extract<Landmark, { kind: 'door' }>).side === side,
        )
          .map(l => l.relativeZ)
          .sort((a, b) => a - b)
        for (let i = 1; i < zs.length; i++) {
          expect(Math.abs(zs[i]! - zs[i - 1]!)).toBeGreaterThanOrEqual(4)
        }
      }
    })

    it('门与同侧家具不重叠（间距 ≥ 4）', () => {
      const doors = CORRIDOR_LANDMARKS.filter(l => l.kind === 'door')
      const furniture = CORRIDOR_LANDMARKS.filter(l => l.kind === 'furniture')
      for (const door of doors) {
        for (const item of furniture) {
          const sameSide =
            (door as Extract<Landmark, { kind: 'door' }>).side ===
            (item as Extract<Landmark, { kind: 'furniture' }>).side
          if (!sameSide) continue
          expect(
            Math.abs(door.relativeZ - item.relativeZ),
            `${door.id} 与 ${item.id} 同侧且过近`,
          ).toBeGreaterThanOrEqual(4)
        }
      }
    })
  })
})
