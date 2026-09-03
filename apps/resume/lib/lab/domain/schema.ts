import { z } from 'zod'

import { ACHIEVEMENT_IDS, DOOR_SLOTS, DOOR_TEXTURE_TYPES, ROOM_IDS } from './ids'
import { AUDIO_BUSES } from './audio/manifest'

/**
 * domain 声明的运行时校验 schema。
 *
 * **只在测试与构建期使用，不进运行时 bundle**（ADR 20260903140615）——
 * 声明是 TypeScript 常量，编译期已经有类型检查；zod 补的是类型系统表达不了
 * 的那部分：数值区间、路径形状、引用完整性、字段之间的一致性。
 *
 * 为什么值得加：审计里有一整类问题是"声明写了但内容不对"，而 TypeScript
 * 看不出来——
 *
 * - `ROOM_ASSETS.contact` 少了整批云纹理 → 云退化成四个灰矩形（A2）
 * - `SOUND_PATHS.paper_tear` 指向不存在的文件 → 每次传送两次 404（B2）
 * - `corridor_bg` 只有 `.ogg` → 所有 Safari / iOS 静音（C1）
 * - 门的 Z 坐标在四处各写一份，改一处漏三处（B3）
 *
 * 这些全是"合法的 TypeScript、错误的内容"。
 */

const roomId = z.enum(ROOM_IDS)
const achievementId = z.enum(ACHIEVEMENT_IDS)
const doorSlot = z.union(DOOR_SLOTS.map(s => z.literal(s)) as [z.ZodLiteral<0>, z.ZodLiteral<1>, ...z.ZodLiteral<number>[]])

/** 站内绝对路径，必须以 / 开头且带扩展名 */
const assetPath = z
  .string()
  .regex(/^\/[\w\-./]+\.\w{2,5}$/, '必须是以 / 开头、带扩展名的站内绝对路径')

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

// ─── 走廊布局 ────────────────────────────────────────────────────────────────

export const corridorDoorSchema = z.object({
  slot: doorSlot,
  roomId,
  // 门都在段内、朝 −Z 方向排布；正数或超出段长都说明写错了
  relativeZ: z.number().lt(0).gt(-100),
  side: z.enum(['left', 'right']),
  textureType: z.enum(DOOR_TEXTURE_TYPES),
})

export const corridorFurnitureSchema = z.object({
  kind: z.enum(['desk', 'cabinet', 'potted-tree']),
  relativeZ: z.number().lt(0).gt(-100),
  side: z.enum(['left', 'right']),
})

// ─── 音频 ────────────────────────────────────────────────────────────────────

export const spatialSchema = z.object({
  refDistance: z.number().positive(),
  rolloffFactor: z.number().positive(),
  distanceModel: z.enum(['linear', 'inverse', 'exponential']),
})

export const soundDefSchema = z.object({
  src: z.array(assetPath).min(1, '至少要有一个候选源'),
  bus: z.enum(AUDIO_BUSES),
  loop: z.boolean().optional(),
  pool: z.number().int().positive().optional(),
  spatial: spatialSchema.optional(),
})

// ─── 房间 ────────────────────────────────────────────────────────────────────

export const entryPoseSchema = z.object({
  position: vec3,
  target: vec3,
  duration: z.number().min(0).max(5),
}).refine(
  pose => pose.position.some((v, i) => v !== pose.target[i]),
  { message: 'position 与 target 相同 → lookAt 无方向，相机朝向未定义' },
)

export const cameraFreedomSchema = z.object({
  azimuth: z.tuple([z.number(), z.number()]).refine(([lo, hi]) => lo < hi, '区间必须 lo < hi'),
  polar: z.tuple([z.number(), z.number()]).refine(([lo, hi]) => lo < hi, '区间必须 lo < hi'),
  distance: z
    .tuple([z.number().positive(), z.number().positive()])
    .refine(([lo, hi]) => lo < hi, '区间必须 lo < hi'),
})

export const fogSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '必须是 #rrggbb'),
  near: z.number().positive(),
  far: z.number().positive(),
}).refine(f => f.near < f.far, { message: 'near 必须小于 far，否则整屏被雾填满' })

export const ambienceSchema = z.object({
  soundId: z.string().min(1),
  position: vec3,
  refDistance: z.number().positive(),
  rolloffFactor: z.number().positive(),
})

export const roomDefinitionSchema = z.object({
  id: roomId,
  doorSlot,
  labelKey: roomId,
  entryPose: entryPoseSchema,
  cameraFreedom: cameraFreedomSchema.nullable(),
  fog: fogSchema.nullable(),
  ambience: ambienceSchema.nullable(),
  assets: z.array(assetPath),
  tutorial: achievementId.nullable(),
  /*
    这里原先有 `view: z.function()`。`view` 已搬到 `components/rooms/registry.ts`
    ——它是"房间长什么样"，属于 interface 层；domain 只声明"房间是什么"
    （ADR 20260903211338，`__tests__/domainPurity.test.ts` 守这条边界）。
  */
})

// ─── 成就 ────────────────────────────────────────────────────────────────────

export const achievementTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('room-entered'), roomId }),
  z.object({ kind: z.literal('room-interaction'), roomId }),
  z.object({ kind: z.literal('corridor-scroll') }),
  z.object({ kind: z.literal('gallery-route') }),
])

export const achievementDefinitionSchema = z.object({
  id: achievementId,
  titleKey: achievementId,
  unlockedBy: achievementTriggerSchema,
  persisted: z.boolean(),
})
