import { inkableLandmarkIds, landmarkById } from './landmarks'

/**
 * 显形（墨迹）策略——`RevealMaterial` 的 `uProgress` 从哪来（ADR 20260908172231）。
 *
 * `uProgress` **只有一个**，而三个特性都要写它（墨迹记忆、圈数、门 hover）。
 * 三处各写就是三个写者抢一个 uniform，表现为闪烁，且没有任何测试守得住。
 *
 * `max` 的语义是「墨迹只会更浓，不会变淡」，单调性可测
 * （`__tests__/corridorInk.test.ts`）。悬停虽然是组件本地的瞬态量，
 * 也作为参数进来比大小——一扇记住的门（1）被悬停（0.6）时不该变淡。
 */

/** 加载显形的窗口宽度 = 步长的多少倍。1 = 一格一格跳；2 = 窗口重叠一半、连成一笔 */
export const INK_LOAD_OVERLAP = 2

export interface InkInputs {
  /** 已显形的地标 id（记忆，持久化） */
  readonly inked: ReadonlySet<string>
  /** 第几圈（0 起） */
  readonly lap: number
  /** 0–1，组件本地的悬停量。省略 = 0 */
  readonly hover?: number
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** 加载显形的顺序：越靠近入口的越早。走廊朝 −Z 延伸，所以 `relativeZ` 降序 */
const LOAD_ORDER: readonly string[] = [...inkableLandmarkIds()].sort((a, b) => {
  const za = landmarkById(a)?.relativeZ ?? 0
  const zb = landmarkById(b)?.relativeZ ?? 0
  return zb - za // 负数：−8 排在 −56 之前
})

const ORDER_INDEX = new Map(LOAD_ORDER.map((id, index) => [id, index]))

/**
 * 「画出来」的进度窗（规格 §1 决定 D 的修订版）：0.3 → 0.9 线性映射到 0 → 1。
 * 纸**不在 30% 撕开**——那版实测撕开后是空页面。
 */
export const INTRO_TEAR_AT = 0.3
export const INTRO_DRAWN_AT = 0.9

/** 把进度（0–1）映射到"画出来"的总量（0–1）：0.3 前为 0，0.9 后为 1 */
export function introDrawLevel(loadProgress: number): number {
  const p = clamp01(loadProgress)
  return clamp01((p - INTRO_TEAR_AT) / (INTRO_DRAWN_AT - INTRO_TEAR_AT))
}

/** 地标在加载序列里的序号（0 起）。未知 id 返回 −1 */
export function loadInkOrder(id: string): number {
  return ORDER_INDEX.get(id) ?? -1
}

/**
 * 加载过场里这个地标被「画」到什么程度。
 *
 * **不参与 `inkLevel`**：加载进度在加载完成后恒为 1，并进 `max` 会让所有门
 * 永久上色，「只有看过的才上色」直接失效。加载显形是过场表演，演完退回稳态。
 *
 * 每个地标占一个窗口 `[t0, t0 + width]`，宽度是步长的 `INK_LOAD_OVERLAP` 倍，
 * 所以相邻窗口重叠、连成一笔；首个从 0 开始、末个在 1 结束。
 */
export function loadIntroInk(id: string, loadProgress: number): number {
  const index = loadInkOrder(id)
  if (index < 0) return 0
  const count = LOAD_ORDER.length
  const progress = clamp01(loadProgress)
  if (count <= 1) return progress

  const width = Math.min(1, INK_LOAD_OVERLAP / count)
  const step = (1 - width) / (count - 1)
  const start = index * step
  return clamp01((progress - start) / width)
}

/**
 * 一个地标此刻该显形到什么程度（0 = 草稿，1 = 完全上色）。
 *
 * @param id 地标 id。未知 id 返回 0（记忆里可能存着已删除的地标）
 */
/**
 * 第二圈起未访问的门的基线。不是 1：全部上色会把"哪些看过"的记忆抹掉，且与顶栏
 * 「已探索 N / M」互相否证（产品评审）。0.55 明显有色、又与已访问的 1 分得开；
 * 第二圈的辨识度交给段末门的正字、猫的"又是你"和狗的一句。
 */
export const LAP_INK = 0.55

export function inkLevel(id: string, inputs: InkInputs): number {
  if (inputs.inked.has(id)) return 1
  const lap = Number.isFinite(inputs.lap) ? inputs.lap : 0
  const hover = clamp01(inputs.hover ?? 0)
  if (lap >= 1) return Math.max(LAP_INK, hover)
  return hover
}
