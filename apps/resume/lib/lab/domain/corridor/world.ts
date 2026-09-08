import { segmentIndexAtZ, segmentStartZ } from './layout'
import { landmarksInSegment, type Landmark } from './landmarks'

/**
 * 走廊世界状态 —— 类型与纯派生（ADR 20260908172231）。
 *
 * ## 这个文件存在的理由
 *
 * 走廊要加的九件事（加载时把走廊画出来、时间线墙、招聘官路线、墨迹记忆、
 * 纸随风动、三扇窗、会说话的头像、第二圈变化、手绘地图）加上活物，读的是
 * **同一组量**：导轨在哪、多快、加载到哪、去过哪、第几圈、几点、要不要减少动效。
 *
 * 而在此之前这组量散在五处、且大半根本不存在：导轨 z 锁在
 * `useCorridorCamera` 的 ref 里（外部只能读 `camera.position.z`）、**速度没人算**、
 * 加载进度只有 `LabLoader` 知道、"去过哪扇门"没有任何地方记、圈数与当地时间
 * 不存在、`prefers-reduced-motion` 在 Lab 里完全没实现。
 *
 * 九件事若各自去建一套读法，会重演 `layout.ts` 之前的局面：同一组门的 Z 写在
 * 四处、段号计算写在三处（其中一处是裸 `/ 100`），改一处漏三处、不报错。
 *
 * ## 分工
 *
 * - 本文件（domain）：**形状 + 纯函数**。不 import react / three / zustand。
 * - `lib/lab/app/stores/corridorStore.ts`（app）：运行时持有者。
 * - `hooks/useCorridorCamera.ts`：**唯一**写导轨量的地方（门禁
 *   `__tests__/railWriter.test.ts` 全禁第二个写者）。
 *
 * store 不写相机 —— 它是导轨状态的**镜像**。相机所有权（ADR 20260903211244）
 * 完全不变：走廊侧仍由 `useCorridorCamera` 持有相机。
 */

// ─── 形状 ────────────────────────────────────────────────────────────────────

/** 走廊模式。房间生命周期仍归 `room.machine`，这里只区分"走廊在干什么" */
export type CorridorMode = 'free' | 'touring' | 'teleporting' | 'inRoom'

/** 运动档。给活物的步频、脚步声音量、纸张摆动共用一个判据 */
export type MotionBand = 'still' | 'walk' | 'run'

export interface CorridorWorld {
  /** 每帧量。`velocity` 单位是**世界单位/秒**，负数 = 前进（走廊朝 −Z 延伸） */
  readonly rail: { readonly z: number; readonly velocity: number }
  readonly mode: CorridorMode
  /** 0–1。来自 `useStableProgress`（单调，不会在加载波次之间回跳） */
  readonly loadProgress: number
  /** 第几圈（0 起）。段门上写着 `while(true) { explore(); }`，圈数是那个梗的状态 */
  readonly lap: number
  /** 经过过的地标 id */
  readonly visited: ReadonlySet<string>
  /** 已显形（草稿 → 上色）的地标 id */
  readonly inked: ReadonlySet<string>
  /** 0 = 系统要求减少动效（持续动画一律静止），1 = 正常 */
  readonly motionScale: 0 | 1
}

export const EMPTY_WORLD: CorridorWorld = {
  rail: { z: 0, velocity: 0 },
  mode: 'free',
  loadProgress: 0,
  lap: 0,
  visited: new Set(),
  inked: new Set(),
  motionScale: 1,
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

/**
 * 「站住不动」的速度上限（单位/秒）。
 *
 * 导轨每帧向目标插值（`smoothing` 0.035），阻尼的尾巴会让 z 在目标附近持续
 * 微动 —— 阈值太小等于"永远在走"。0.6 单位/秒 ≈ 每帧 0.01 单位 @60fps，
 * 与 `exploration.ts` 里 `EXPLORE_MIN_DISTANCE = 2` 的量级一致。
 */
export const SPEED_STILL = 0.6

/**
 * 「跑」的速度下限（单位/秒）。
 *
 * 一次滚轮 delta 100 × `scrollSpeed` 0.02 = 2 单位的目标位移，插值后峰值约
 * 20 单位/秒；连续滚动会更高。取 18 让"连续滚动"落在 run、"单格滚动"落在 walk。
 */
export const SPEED_RUN = 18

/**
 * 单帧 delta 的上限（秒）。
 *
 * 标签页切到后台再切回来，`useFrame` 的 delta 可能是几秒 —— 任何"速度 × dt"
 * 的推进都会一步跳过半条走廊。0.05 = 20fps，比它更慢的帧一律按 20fps 算。
 */
export const MAX_FRAME_DELTA = 0.05

/**
 * 速度的指数平滑系数（每帧向瞬时值靠拢的比例）。
 *
 * 瞬时差分（`Δz / Δt`）在滚轮的离散事件下抖得厉害：一格滚轮让目标跳 2 单位，
 * 之后 30 帧衰减 —— 直接用瞬时值会让脚步声与活物步频每帧变一次。
 */
const VELOCITY_EMA = 0.2

// ─── 纯派生 ──────────────────────────────────────────────────────────────────

const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback)

/**
 * 第几圈（0 起，永不为负）。
 *
 * 相机初始在 Z=28，而第 0 段起点是 Z=10 —— `segmentIndexAtZ(28)` 是 **−1**
 * （`InfiniteCorridorManager` 依赖这个负数来挂载 `[−2, −1, 0]`，那是对的）。
 * 但"第 −1 圈"对用户可见的一切（第二圈变体、成就）都是错的，所以这里夹到 0。
 */
export function lapAt(cameraZ: number): number {
  if (!Number.isFinite(cameraZ)) return 0
  return Math.max(0, segmentIndexAtZ(cameraZ))
}

/** 夹紧帧时长，见 `MAX_FRAME_DELTA` */
export function clampDelta(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0
  return Math.min(dt, MAX_FRAME_DELTA)
}

/**
 * 速度的指数平滑。
 *
 * @param previous 上一帧的速度（单位/秒）
 * @param deltaZ 这一帧的位移（世界单位，负数 = 前进）
 * @param dt 这一帧的时长（秒）
 *
 * `dt` 为 0（首帧、同一帧被调两次）时返回上一帧的值 —— 除以 0 会得到
 * `±Infinity`，而它会**永久**污染后续每一帧（`Infinity * 0.8 + x * 0.2` 仍是
 * `Infinity`）。这类"一次坏值污染整个会话"的形态在 `scrollSkew` 那次事故里
 * 出现过：skewY 被推到 88° 之后再没有事件把它拉回来。
 */
export function smoothVelocity(previous: number, deltaZ: number, dt: number): number {
  const prev = finite(previous)
  const dz = finite(deltaZ)
  const step = clampDelta(dt)
  if (step <= 0) return prev
  const instant = dz / step
  return prev + (instant - prev) * VELOCITY_EMA
}

/** 速度 → 运动档。方向不影响快慢，所以取绝对值 */
export function motionOf(velocity: number): MotionBand {
  const speed = Math.abs(finite(velocity))
  if (speed < SPEED_STILL) return 'still'
  if (speed < SPEED_RUN) return 'walk'
  return 'run'
}

export interface DoorAhead {
  readonly landmark: Landmark
  readonly worldZ: number
  readonly segmentIndex: number
  /** 相机到门的距离（正数） */
  readonly distance: number
}

/**
 * 相机**前方**（世界 z 更小的一侧）最近的门。
 *
 * 用途：活物选侧道（走下一扇门的对侧，不挡门）、招聘官路线的下一站、
 * 地图上的"你在这里"。
 *
 * 扫描当前段与前后各一段：门在段内的相对 z 固定，但相机可能正好在段边界上
 * （`segmentIndexAtZ` 在 Z=28 时是 −1，而第一扇门在第 0 段）。
 */
export function nearestDoorAhead(cameraZ: number): DoorAhead | null {
  if (!Number.isFinite(cameraZ)) return null
  const current = segmentIndexAtZ(cameraZ)
  let best: DoorAhead | null = null

  for (const offset of [0, 1, 2]) {
    const segmentIndex = current + offset
    if (segmentIndex < 0) continue
    const base = segmentStartZ(segmentIndex)
    for (const landmark of landmarksInSegment(segmentIndex)) {
      if (landmark.kind !== 'door') continue
      const worldZ = base + landmark.relativeZ
      const distance = cameraZ - worldZ
      if (distance <= 0) continue // 已经走过
      if (best === null || distance < best.distance) {
        best = { landmark, worldZ, segmentIndex, distance }
      }
    }
  }
  return best
}

/**
 * 这一帧相机落在哪些地标的"经过"半径内。
 *
 * 只看当前段与相邻段 —— 走廊无限延伸，每段结构相同，扫全部段既慢又会把
 * 几百单位外的同名地标算进来。
 */
export function visitedNow(cameraZ: number): readonly string[] {
  if (!Number.isFinite(cameraZ)) return []
  const current = segmentIndexAtZ(cameraZ)
  const hits: string[] = []

  for (const offset of [-1, 0, 1]) {
    const segmentIndex = current + offset
    if (segmentIndex < 0) continue
    const base = segmentStartZ(segmentIndex)
    for (const landmark of landmarksInSegment(segmentIndex)) {
      const radius = landmark.visitRadius ?? 0
      if (radius <= 0) continue
      if (Math.abs(cameraZ - (base + landmark.relativeZ)) <= radius) hits.push(landmark.id)
    }
  }
  return hits
}
