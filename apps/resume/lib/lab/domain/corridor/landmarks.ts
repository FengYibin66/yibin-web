import type { DoorSlot, DoorTextureType, RoomId, WallSide } from '../ids'
import {
  BUG_RELATIVE_Z,
  CORRIDOR_DOORS,
  CORRIDOR_FURNITURE,
  HERO_RELATIVE_Z,
  SEGMENT_DOOR_RELATIVE_Z,
} from './layout'

/**
 * 走廊地标表 —— **一切有位置的东西**的唯一来源（ADR 20260908172231）。
 *
 * ## 为什么在 `layout.ts` 之外还要一张表
 *
 * `layout.ts` 已经把门与家具的坐标收成单一来源（审计 B3：同一组门的 Z 原先
 * 写在四处，段号计算写在三处，其中一处是裸 `/ 100`）。但它是**按类型分表**的：
 * 门一张、家具一张、欢迎区 / 彩蛋 / 段末门各一个裸常量、吊灯一条布局规则。
 * 加窗、年份刻度、活物锚点之后会变成十套，而下面这些约束**没有任何一张分表
 * 能表达**：
 *
 * - 同一侧两个地标不许重叠（门 vs 家具 vs 窗，跨类型）
 * - 哪些地标能被"显形"（`RevealMaterial` 的墨迹记忆，按 id 存）
 * - 哪些地标算"经过"（进入半径 → 记忆 / 成就 / 地图上的已访问标记）
 * - 壁画要避开哪些地标（今天是 `lib/lab/corridorMurals.ts` 里**手写的第二套
 *   坐标真相** `MURAL_KEEP_OUTS`，`layout.ts` 头部把它登记为「暂未迁入」）
 *
 * 所以这张表按**位置**而不是按类型组织：一个 `kind` 判别联合 + 三个公共字段
 * （`segments` / `inkable` / `visitRadius`）+ 可选 `keepOut`。
 *
 * ## 与 `layout.ts` 的分工
 *
 * `layout.ts` 保留**几何与派生计算**（段长、墙距、`segmentIndexAtZ`、
 * `doorWorldZ`…）以及既有的 `CORRIDOR_DOORS` / `CORRIDOR_FURNITURE` 导出；
 * 本表是那些坐标的**上游**——门与家具的条目在这里声明，两张旧表的数值由
 * 本文件的测试逐项锁定（`__tests__/corridorLandmarks.test.ts`）。
 *
 * 刻意**不**在这一次把 `CORRIDOR_DOORS` 改成从本表派生：那两个导出有 7 个
 * 消费者（渲染、相机侧扫、传送、壁画、预载表…），一次动完的改动面大而收益
 * 为零。等本表的消费者铺开后再收（届时删除的是旧表，不是新表）。
 *
 * ## 壁画不在这张表里
 *
 * 壁画（`corridorMurals.ts`）是**从候选槽位 + 避让计算派生**的，且带相册轮转
 * ——它是这张表的**消费者**，不是条目。表里只声明"壁画要避开我"（`keepOut`）。
 *
 * 吊灯同理：它是一条布局规则（每 15 单位一盏，`LAMP_LAYOUT`），不是一组地标。
 */

// ─── 类型 ────────────────────────────────────────────────────────────────────

/**
 * 地标出现在哪些段。
 *
 * 走廊在 Z 轴上无限延伸，每段结构相同（`InfiniteCorridorManager` 挂载
 * 当前段 ±1）。`'all'` = 每段都有；数组 = 只在列出的段号出现。
 *
 * 有这个字段是因为不是所有东西都该重复：一只守着相框的猫在第 3 段再出现一只
 * 就不是"一只猫"了，而年份刻度（第 3 期）按定义只属于第 0 段。
 */
export type LandmarkSegments = 'all' | readonly number[]

interface LandmarkCommon {
  /**
   * 稳定标识。**是记忆的键**（`visited` / `inked` 存的就是这些 id，进
   * localStorage），所以改名等于让老访客的记忆失效——要改先想清楚，或加迁移。
   */
  readonly id: string
  /** 段内相对 Z（负数，越小越深） */
  readonly relativeZ: number
  readonly segments: LandmarkSegments
  /** 是否参与显形（`RevealMaterial` 的草稿→上色）。见 `ink.ts` */
  readonly inkable: boolean
  /**
   * 相机进入这个半径算"经过"（世界单位）。省略 = 不追踪。
   *
   * 门用 8：与 `useCorridorCamera` 的自动侧瞄起点（`GLANCE_START_DIST` 15）
   * 同量级但更近——"侧瞄到了"不等于"经过了"，后者要真的走到门口。
   */
  readonly visitRadius?: number
  /**
   * 壁画避让区。`side: 'both'` = 挡两面墙。
   *
   * 门只挡**自己那面墙**（对面墙上正对着门挂画是刻意的构图），所以门的
   * `keepOut.side` 等于门自己的 `side`；欢迎区与段末门横跨走廊，挡两面。
   */
  readonly keepOut?: { readonly side: WallSide | 'both'; readonly radius: number }
}

export type Landmark =
  | (LandmarkCommon & {
      readonly kind: 'door'
      readonly slot: DoorSlot
      readonly roomId: RoomId
      readonly side: WallSide
      readonly textureType: DoorTextureType
    })
  | (LandmarkCommon & {
      readonly kind: 'furniture'
      readonly side: WallSide
      readonly variant: 'desk' | 'cabinet' | 'potted-tree'
    })
  /** 欢迎区（HeroText + Avatar + Doodles），横跨走廊中央 */
  | (LandmarkCommon & { readonly kind: 'hero' })
  /** 段末双开门，通往下一段 */
  | (LandmarkCommon & { readonly kind: 'segment-door' })
  | (LandmarkCommon & { readonly kind: 'easter'; readonly variant: 'bug' })
  /** 窗（第 3 期：三扇窗三座城） */
  | (LandmarkCommon & {
      readonly kind: 'window'
      readonly side: WallSide
      readonly city: string
    })
  /** 年份刻度（第 3 期：时间线墙） */
  | (LandmarkCommon & {
      readonly kind: 'year-mark'
      readonly side: WallSide
      readonly year: number
    })
  /** 活物驻点（ADR 20260908160918：守相框的猫） */
  | (LandmarkCommon & {
      readonly kind: 'companion-anchor'
      readonly side: WallSide
      readonly companion: 'cat'
    })

// ─── 常量 ────────────────────────────────────────────────────────────────────

/**
 * 门的壁画避让半径 = 门龛半宽 2.0 + 边缘留白 4.5。
 *
 * 数值与 `corridorMurals.ts` 的 `DOOR_KEEP_RADIUS` 相同，但**这里是上游**：
 * 那份由 `DOOR_Z_SPAN`（来自 `DoorSection`）+ `DOOR_EDGE_CLEARANCE` 算出，
 * 两者由 `__tests__/corridorLandmarks.test.ts` 的等价性断言锁定。
 */
const DOOR_KEEP_RADIUS = 6.5

/** 家具的避让半径，按各自实际占位（桌最宽、柜最窄） */
const FURNITURE_KEEP_RADIUS: Readonly<Record<'desk' | 'cabinet' | 'potted-tree', number>> = {
  desk: 2.8,
  cabinet: 2.4,
  'potted-tree': 2.6,
}

const DOOR_LANDMARKS: readonly Landmark[] = CORRIDOR_DOORS.map(door => ({
  kind: 'door' as const,
  id: `door-${door.roomId}`,
  slot: door.slot,
  roomId: door.roomId,
  side: door.side,
  textureType: door.textureType,
  relativeZ: door.relativeZ,
  segments: 'all' as const,
  inkable: true,
  visitRadius: 8,
  keepOut: { side: door.side, radius: DOOR_KEEP_RADIUS },
}))

const FURNITURE_LANDMARKS: readonly Landmark[] = CORRIDOR_FURNITURE.map(item => ({
  kind: 'furniture' as const,
  id: item.kind,
  variant: item.kind,
  side: item.side,
  relativeZ: item.relativeZ,
  segments: 'all' as const,
  inkable: false,
  visitRadius: 4,
  keepOut: { side: item.side, radius: FURNITURE_KEEP_RADIUS[item.kind] },
}))

/**
 * 全部地标。
 *
 * 门与家具从 `layout.ts` 的两张表映射而来（见文件头「与 layout.ts 的分工」），
 * 其余三个原先是裸常量。
 */
export const CORRIDOR_LANDMARKS: readonly Landmark[] = [
  {
    kind: 'hero',
    id: 'welcome-avatar',
    relativeZ: HERO_RELATIVE_Z,
    segments: 'all',
    inkable: false,
    keepOut: { side: 'both', radius: 4.0 },
  },
  ...DOOR_LANDMARKS,
  ...FURNITURE_LANDMARKS,
  {
    kind: 'easter',
    id: 'bug',
    variant: 'bug',
    relativeZ: BUG_RELATIVE_Z,
    segments: 'all',
    inkable: false,
    visitRadius: 3,
  },
  {
    kind: 'segment-door',
    id: 'segment-door',
    relativeZ: SEGMENT_DOOR_RELATIVE_Z,
    segments: 'all',
    inkable: false,
    keepOut: { side: 'both', radius: 5.5 },
  },
] as const

// ─── 派生查询 ────────────────────────────────────────────────────────────────

const BY_ID = new Map(CORRIDOR_LANDMARKS.map(l => [l.id, l]))

/** 按 id 取地标。未知 id 返回 `undefined`（记忆里可能存着已删除地标的 id） */
export function landmarkById(id: string): Landmark | undefined {
  return BY_ID.get(id)
}

/** 出现在第 `segmentIndex` 段的地标 */
export function landmarksInSegment(segmentIndex: number): readonly Landmark[] {
  return CORRIDOR_LANDMARKS.filter(
    l => l.segments === 'all' || l.segments.includes(segmentIndex),
  )
}

/** 需要追踪"经过"的地标（声明了 `visitRadius` 的） */
export function visitTargets(): readonly Landmark[] {
  return CORRIDOR_LANDMARKS.filter(l => (l.visitRadius ?? 0) > 0)
}

/** 参与显形的地标 id */
export function inkableLandmarkIds(): readonly string[] {
  return CORRIDOR_LANDMARKS.filter(l => l.inkable).map(l => l.id)
}

export interface MuralKeepOutZone {
  readonly side: WallSide | 'both'
  readonly z: number
  readonly radius: number
  /** 是哪个地标要求的避让。与地标 id 相同 —— 便于反查"这块画为什么放不下" */
  readonly reason: string
}

/**
 * 壁画避让区，由地标的 `keepOut` 派生。
 *
 * 取代 `corridorMurals.ts` 里手写的 `MURAL_KEEP_OUTS`。两者的逐项相等由
 * `__tests__/corridorLandmarks.test.ts` 断言——那条断言是这次重构的**证据**：
 * 壁画位置的变化在单测里看不见，只会在实机截图上表现为"画压在门上"。
 */
export function muralKeepOuts(): readonly MuralKeepOutZone[] {
  return CORRIDOR_LANDMARKS.filter(l => l.keepOut !== undefined).map(l => ({
    side: l.keepOut!.side,
    z: l.relativeZ,
    radius: l.keepOut!.radius,
    reason: l.id,
  }))
}
