import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ROOM_IDS, DOOR_TEXTURE_TYPES, ACHIEVEMENT_IDS } from '@/lib/lab/domain/ids'
import {
  CORRIDOR_DOORS,
  CORRIDOR_FURNITURE,
  SEGMENT_LENGTH,
  doorForRoom,
  doorWorldZ,
  lampZsForSegment,
  segmentIndexAtZ,
  segmentStartZ,
} from '@/lib/lab/domain/corridor/layout'
import {
  AVATAR_ANIM_FRAMES,
  DERIVED_CORRIDOR_TEXTURES,
  DOOR_TEXTURES,
  USED_DOOR_TEXTURE_TYPES,
  unusedDoorTextureTypes,
} from '@/lib/lab/domain/corridor/assets'
import { ROOMS, ROOMS_IN_CORRIDOR_ORDER } from '@/lib/lab/domain/rooms'
import { ACHIEVEMENT_DEFS, PERSISTED_ACHIEVEMENTS } from '@/lib/lab/domain/achievements/defs'
import { SOUND_MANIFEST, allSoundSources } from '@/lib/lab/domain/audio/manifest'
import {
  achievementDefinitionSchema,
  corridorDoorSchema,
  corridorFurnitureSchema,
  roomDefinitionSchema,
  soundDefSchema,
} from '@/lib/lab/domain/schema'
import { ALL_ASSETS, ROOM_ASSETS as GENERATED_ROOM_ASSETS } from '@/lib/lab/app/assets/manifest.gen'

/**
 * domain 声明层的门禁（ADR 20260903140615）。
 *
 * 审计里有一整类问题是「**合法的 TypeScript、错误的内容**」——类型检查看不出，
 * 运行时也不报错，只是静默地少一张贴图、多一次 404、或者传送落到错误的位置：
 *
 *   - `ROOM_ASSETS.contact` 少了整批云纹理 → 云退化成四个灰矩形（A2）
 *   - `SOUND_PATHS.paper_tear` 指向不存在的文件 → 每次传送两次 404（B2）
 *   - `corridor_bg` 只有 `.ogg` → 所有 Safari / iOS 静音（C1）
 *   - 门的 Z 坐标在四处各写一份，改一处漏三处（B3）
 *   - `gallery_inspect` 的解锁源落在零渲染方的组件里 → 成就永远解不开（D1）
 *
 * 这些的共同修法是：声明变成唯一来源，然后**断言声明与磁盘、声明与声明之间
 * 的一致性**。
 */

const APP_ROOT = join(__dirname, '..')
const PUBLIC_ROOT = join(APP_ROOT, 'public')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

// ─── schema 校验 ─────────────────────────────────────────────────────────────

describe('声明通过 zod schema', () => {
  it.each(Object.values(ROOMS).map(r => [r.id, r] as const))('房间 %s', (_id, room) => {
    const result = roomDefinitionSchema.safeParse(room)
    expect(result.success ? null : result.error.issues).toBeNull()
  })

  it.each(CORRIDOR_DOORS.map(d => [d.roomId, d] as const))('门 %s', (_id, door) => {
    const result = corridorDoorSchema.safeParse(door)
    expect(result.success ? null : result.error.issues).toBeNull()
  })

  it.each(CORRIDOR_FURNITURE.map(f => [f.kind, f] as const))('家具 %s', (_kind, item) => {
    const result = corridorFurnitureSchema.safeParse(item)
    expect(result.success ? null : result.error.issues).toBeNull()
  })

  it.each(Object.entries(SOUND_MANIFEST))('音频 %s', (_name, def) => {
    const result = soundDefSchema.safeParse(def)
    expect(result.success ? null : result.error.issues).toBeNull()
  })

  it.each(Object.entries(ACHIEVEMENT_DEFS))('成就 %s', (_id, def) => {
    const result = achievementDefinitionSchema.safeParse(def)
    expect(result.success ? null : result.error.issues).toBeNull()
  })
})

// ─── 引用完整性 ───────────────────────────────────────────────────────────────

describe('注册表引用完整', () => {
  it('每个 RoomId 都有声明，没有多余声明', () => {
    expect(Object.keys(ROOMS).sort()).toEqual([...ROOM_IDS].sort())
    for (const id of ROOM_IDS) expect(ROOMS[id].id).toBe(id)
  })

  it('门位一一对应，不重不漏（B3 的根因是同一组坐标写了四份）', () => {
    const slotsFromRooms = Object.values(ROOMS).map(r => r.doorSlot).sort()
    const slotsFromLayout = CORRIDOR_DOORS.map(d => d.slot).sort()
    expect(slotsFromRooms).toEqual(slotsFromLayout)
    expect(new Set(slotsFromRooms).size).toBe(slotsFromRooms.length)
  })

  it('房间与门互指一致', () => {
    for (const room of Object.values(ROOMS)) {
      expect(doorForRoom(room.id).slot, `${room.id} 的 doorSlot 与布局不一致`).toBe(room.doorSlot)
    }
  })

  it('走廊顺序 = 门位顺序', () => {
    const slots = ROOMS_IN_CORRIDOR_ORDER.map(r => r.doorSlot)
    expect(slots).toEqual([...slots].sort((a, b) => a - b))
    expect(ROOMS_IN_CORRIDOR_ORDER).toHaveLength(ROOM_IDS.length)
  })

  it('每个房间的 ambience 指向清单里真实存在的音频', () => {
    for (const room of Object.values(ROOMS)) {
      if (!room.ambience) continue
      expect(
        Object.keys(SOUND_MANIFEST),
        `${room.id} 的 ambience.soundId "${room.ambience.soundId}" 不在音频清单里`,
      ).toContain(room.ambience.soundId)
    }
  })

  it('每个房间的 tutorial 指向真实成就', () => {
    for (const room of Object.values(ROOMS)) {
      if (!room.tutorial) continue
      expect(ACHIEVEMENT_IDS).toContain(room.tutorial)
    }
  })

  it('成就的解锁源指向真实房间 —— D1 的修法就是这条', () => {
    for (const def of Object.values(ACHIEVEMENT_DEFS)) {
      const trigger = def.unlockedBy
      if (trigger.kind === 'room-entered' || trigger.kind === 'room-interaction') {
        expect(ROOM_IDS, `${def.id} 指向不存在的房间`).toContain(trigger.roomId)
      }
    }
  })

  it('corridor_enter 不持久化（入门提示每次访问都该出现）', () => {
    expect(ACHIEVEMENT_DEFS.corridor_enter.persisted).toBe(false)
    expect(PERSISTED_ACHIEVEMENTS).not.toContain('corridor_enter')
    expect(PERSISTED_ACHIEVEMENTS).toHaveLength(ACHIEVEMENT_IDS.length - 1)
  })

  it('gallery_inspect 的解锁源是独立路由，不是 3D 房间（审计 D1）', () => {
    expect(ACHIEVEMENT_DEFS.gallery_inspect.unlockedBy.kind).toBe('gallery-route')
  })
})

// ─── 资源存在性 ───────────────────────────────────────────────────────────────

describe('声明的资源都真实存在', () => {
  const roomAssetPairs = Object.values(ROOMS).flatMap(room =>
    room.assets.map(asset => [room.id, asset] as const),
  )

  it('声明里有足够多的资源 —— 前提校验，防止空跑', () => {
    expect(roomAssetPairs.length).toBeGreaterThan(50)
    expect(DERIVED_CORRIDOR_TEXTURES.length).toBeGreaterThan(15)
  })

  it.each(roomAssetPairs)('%s 的 %s 存在', (_room, asset) => {
    expect(existsSync(join(PUBLIC_ROOT, asset))).toBe(true)
  })

  it.each(DERIVED_CORRIDOR_TEXTURES.map(p => [p] as const))('派生的走廊纹理 %s 存在', (asset) => {
    expect(existsSync(join(PUBLIC_ROOT, asset))).toBe(true)
  })

  it.each(allSoundSources().map(p => [p] as const))('音频 %s 存在', (src) => {
    expect(existsSync(join(PUBLIC_ROOT, src))).toBe(true)
  })

  it('生成的 ALL_ASSETS 里没有失效路径', () => {
    const missing = ALL_ASSETS.filter(p => !existsSync(join(PUBLIC_ROOT, p)))
    expect(missing, `生成物引用了不存在的文件：${missing.join(', ')}`).toEqual([])
  })
})

// ─── 派生关系：生成物 ⊇ 组件真实用到的 ────────────────────────────────────────

describe('预载表与渲染树一致（不再是两份人手清单）', () => {
  /** 房间组件目录 → 该目录下所有 useTexture/useLoader 的字面量路径 */
  function texturesUsedBy(dirs: readonly string[]): string[] {
    const found = new Set<string>()
    for (const dir of dirs) {
      for (const file of walk(join(APP_ROOT, dir))) {
        if (!/\.tsx?$/.test(file)) continue
        const src = readFileSync(file, 'utf8')
        if (!/useTexture|useLoader/.test(src)) continue
        for (const m of src.matchAll(/'(\/textures\/[^']+\.\w{2,5})'/g)) found.add(m[1]!)
      }
    }
    return [...found]
  }

  it('Publications 组件用到的纹理都在它的声明里', () => {
    const used = texturesUsedBy(['components/rooms/publications'])
    const declared = new Set(ROOMS.publications.assets)
    const missing = used.filter(p => !declared.has(p))
    expect(missing, `publications 声明缺：${missing.join(', ')}`).toEqual([])
  })

  it('Contact 组件用到的纹理都在它的声明里（A2 就是这条漏了云纹理）', () => {
    const used = texturesUsedBy(['components/rooms/contact'])
    const declared = new Set(ROOMS.contact.assets)
    const missing = used.filter(p => !declared.has(p))
    expect(missing, `contact 声明缺：${missing.join(', ')}`).toEqual([])
  })

  it('生成物的 ROOM_ASSETS 与注册表声明一致', () => {
    for (const room of Object.values(ROOMS)) {
      const generated = GENERATED_ROOM_ASSETS[room.id] ?? []
      const declared = [...room.assets].sort()
      expect([...generated].sort(), `${room.id} 生成物与声明不一致，请重新运行 gen-asset-manifest`)
        .toEqual(declared)
    }
  })
})

// ─── 走廊几何 ─────────────────────────────────────────────────────────────────

describe('走廊布局的派生计算', () => {
  it('segmentStartZ 与 segmentIndexAtZ 互为逆运算', () => {
    for (let i = 0; i < 6; i++) {
      // 段内任意一点都该算回同一段号
      expect(segmentIndexAtZ(segmentStartZ(i))).toBe(i)
      expect(segmentIndexAtZ(segmentStartZ(i) - 1)).toBe(i)
      expect(segmentIndexAtZ(segmentStartZ(i) - SEGMENT_LENGTH + 1)).toBe(i)
    }
  })

  it('段边界不重叠 —— 相邻段的边界点归属唯一', () => {
    for (let i = 0; i < 5; i++) {
      const boundary = segmentStartZ(i) - SEGMENT_LENGTH
      expect(segmentIndexAtZ(boundary)).toBe(i + 1)
      expect(segmentIndexAtZ(boundary + 0.001)).toBe(i)
    }
  })

  it('相机初始位置（Z=28）在第 0 段之前 —— 走廊入口在段外', () => {
    expect(segmentIndexAtZ(28)).toBeLessThan(0)
  })

  it('doorWorldZ 随段号平移', () => {
    for (const door of CORRIDOR_DOORS) {
      expect(doorWorldZ(door.slot, 0)).toBe(segmentStartZ(0) + door.relativeZ)
      expect(doorWorldZ(door.slot, 2) - doorWorldZ(door.slot, 1)).toBe(-SEGMENT_LENGTH)
    }
  })

  it('未知门位抛错而不是静默返回 NaN', () => {
    // @ts-expect-error 刻意传非法 slot：静默的 NaN 会让传送落到 Z=NaN
    expect(() => doorWorldZ(9, 0)).toThrow(/未知门位/)
  })

  it('吊灯落在段内且间距一致', () => {
    const zs = lampZsForSegment(1)
    expect(zs.length).toBeGreaterThan(4)
    const start = segmentStartZ(1)
    for (const z of zs) {
      expect(z).toBeLessThanOrEqual(start)
      expect(z).toBeGreaterThan(start - SEGMENT_LENGTH)
    }
    for (let i = 1; i < zs.length; i++) expect(zs[i - 1]! - zs[i]!).toBeCloseTo(15, 6)
  })

  it('门不互相重叠（间距 ≥ 门的 Z 跨度 4）', () => {
    const sorted = [...CORRIDOR_DOORS].sort((a, b) => b.relativeZ - a.relativeZ)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]!.relativeZ - sorted[i]!.relativeZ).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('派生的门贴图', () => {
  it('每种在用的类型都有 sketch + painted 两层', () => {
    expect(DOOR_TEXTURES).toHaveLength(USED_DOOR_TEXTURE_TYPES.length * 2)
    for (const type of USED_DOOR_TEXTURE_TYPES) {
      expect(DOOR_TEXTURES).toContain(`/textures/corridor/doors/drzwi${type}.webp`)
      expect(DOOR_TEXTURES).toContain(`/textures/corridor/doors/drzwi${type}_painted.webp`)
    }
  })

  it('没有声明了却没门在用的贴图类型（有的话是白下载）', () => {
    expect(unusedDoorTextureTypes()).toEqual([])
  })

  it('kontakt 被两扇门共用 —— 去重后只算一次', () => {
    const kontaktDoors = CORRIDOR_DOORS.filter(d => d.textureType === 'kontakt')
    expect(kontaktDoors.length).toBe(2)
    expect(USED_DOOR_TEXTURE_TYPES.filter(t => t === 'kontakt')).toHaveLength(1)
  })

  it('头像动画帧连续编号', () => {
    expect(AVATAR_ANIM_FRAMES).toHaveLength(9)
    AVATAR_ANIM_FRAMES.forEach((path, i) => {
      expect(path).toBe(`/textures/corridor/avatar_anim/${i + 1}.webp`)
    })
  })

  it('DOOR_TEXTURE_TYPES 是全集，USED 是其子集', () => {
    for (const type of USED_DOOR_TEXTURE_TYPES) {
      expect(DOOR_TEXTURE_TYPES).toContain(type)
    }
  })
})
