import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { functionCalls, walkSources } from './helpers/sourceScan'

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

    /**
     * 活物必须离同侧的门足够远，否则**永远看不见**。
     *
     * 这条是实测换来的：猫原本坐在柜顶（−49），而 Gallery 门在 −44 ——
     * 相机走到能看见柜子的距离时，门段的翻板已经绕外墙转了 30°
     * （`DoorSection` 的 `MAX_TILT`，从 `TILT_START` = 15 单位开始转），
     * 整扇门横过来把柜子连猫一起遮住。截图里看不到猫，而三态切换、成就、
     * 单测全是绿的 —— 这类"功能对但看不见"只有实机才发现得了。
     *
     * 15 单位是翻板开始转的距离，所以要求 > 15。
     */
    it('活物驻点距同侧门 > 15 单位（否则被门的翻板遮住）', () => {
      const TILT_START = 15
      const anchors = CORRIDOR_LANDMARKS.filter(
        (l): l is Extract<Landmark, { kind: 'companion-anchor' }> =>
          l.kind === 'companion-anchor',
      )
      expect(anchors.length, '没有活物驻点，这条断言会空跑').toBeGreaterThan(0)

      for (const anchor of anchors) {
        for (const door of CORRIDOR_DOORS) {
          if (door.side !== anchor.side) continue
          expect(
            Math.abs(anchor.relativeZ - door.relativeZ),
            `${anchor.id}（${anchor.relativeZ}）离同侧的 ${door.roomId} 门（${door.relativeZ}）` +
              '太近，相机靠近时门的翻板会把它遮住',
          ).toBeGreaterThan(TILT_START)
        }
      }
    })

    it('猫只在第 0 段出现（一只具体的猫不该每段一只）', () => {
      expect(landmarkById('resident-cat')?.segments).toEqual([0])
      expect(landmarksInSegment(1).map(l => l.id)).not.toContain('resident-cat')
      expect(landmarksInSegment(0).map(l => l.id)).toContain('resident-cat')
    })
  })

  describe('壁画避让由地标派生（迁移完成）', () => {
    /*
      迁移期这里断言派生结果与 corridorMurals 的手写表逐项相等，证明重构没挪壁画。
      窗进了地标表之后手写表不再等价、已删除；现在守的是反向事实：壁画模块里
      **不再有**手写避让表，只从 `muralKeepOuts()` 读。
    */
    it('corridorMurals 里没有手写的 MURAL_KEEP_OUTS，且调用 muralKeepOuts()', () => {
      const source = readFileSync(join(__dirname, '../lib/lab/corridorMurals.ts'), 'utf8')
      expect(source).not.toMatch(/export const MURAL_KEEP_OUTS/)
      expect(source).toMatch(/muralKeepOuts\(\)/)
    })

    it('门 / 家具 / 头像 / 段末门的避让区数值与迁移前一致（重构不挪壁画）', () => {
      const byReason = new Map(muralKeepOuts().map(k => [k.reason, k]))
      const expected: Array<[string, string, number, number]> = [
        ['welcome-avatar', 'both', -2, 4.0],
        ['door-about', 'left', -8, 6.5], ['door-projects', 'right', -20, 6.5],
        ['door-publications', 'left', -32, 6.5], ['door-gallery', 'right', -44, 6.5],
        ['door-contact', 'left', -56, 6.5],
        ['desk', 'left', -27, 2.8], ['cabinet', 'right', -49, 2.4], ['potted-tree', 'left', -63, 2.6],
        ['segment-door', 'both', -95, 5.5],
      ]
      for (const [reason, side, z, radius] of expected) {
        const k = byReason.get(reason)
        expect(k, reason).toBeDefined()
        expect([k!.side, k!.z, k!.radius]).toEqual([side, z, radius])
      }
    })

    it('三扇窗有避让区（半径 1.5）', () => {
      const windows = muralKeepOuts().filter(k => k.reason.startsWith('window-'))
      expect(windows).toHaveLength(3)
      for (const w of windows) expect(w.radius).toBe(1.5)
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

  /**
   * 「地标表必须有运行时消费者」。
   *
   * ## 这条门禁抓过一次真事
   *
   * 2026-09-08：`CorridorSegment` 改为遍历地标渲染之后，做变异测试时用
   * `git checkout` 还原文件，把那次重构**一起还原了**，随后 `git add -A`
   * 提交了旧版。结果是地标表定义完整、schema 与等价性断言全绿、巡检截图正常
   * （旧版渲染出的画面一样），而 `landmarksInSegment` 在生产代码里**零引用**。
   *
   * 这正是 ADR 20260903211338 立规矩要防的那种状态：「已定义、未接线」在
   * 测试里看不出来，因为测试自己会调它。判断落地的操作性标准是
   * `grep -rl <模块> app components context hooks lib` —— 有非测试命中才算接线，
   * 这条断言就是把那句话变成机制。
   */
  describe('接线检查：地标表有生产消费者', () => {
    const PRODUCTION_DIRS = ['app', 'components', 'context', 'hooks', 'lib'] as const
    const ROOT = join(__dirname, '..')

    function productionFilesImporting(symbol: string): string[] {
      const hits: string[] = []
      for (const dir of PRODUCTION_DIRS) {
        for (const file of walkSources(join(ROOT, dir))) {
          const rel = relative(ROOT, file)
          // 声明自身不算消费者
          if (rel.endsWith('domain/corridor/landmarks.ts')) continue
          if (functionCalls(readFileSync(file, 'utf8'), symbol, rel).length > 0) hits.push(rel)
        }
      }
      return hits
    }

    it.each([
      ['landmarksInSegment', '走廊渲染（CorridorSegment 遍历声明）'],
      ['muralKeepOuts', '壁画避让（取代手写的第二套坐标真相）'],
    ])('%s 在生产代码里被调用', (symbol, purpose) => {
      const consumers = productionFilesImporting(symbol)
      expect(
        consumers,
        `${symbol}（${purpose}）在 app/components/context/hooks/lib 下零调用。\n` +
          '这意味着地标表只是一份"定义好但没人用"的数据 —— 测试会调它所以照样全绿，' +
          '而运行时走的还是旧路径（ADR 20260903211338 的教训）。',
      ).not.toEqual([])
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
