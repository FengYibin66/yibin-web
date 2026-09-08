import { inkableLandmarkIds, landmarkById } from './landmarks'

/**
 * 显形（墨迹）策略 —— `RevealMaterial` 的 `uProgress` 从哪来（ADR 20260908172231）。
 *
 * ## 为什么是一条策略而不是三处各写
 *
 * `RevealMaterial`（草稿 → 上色的噪声擦除）此前只服务一件事：门 hover。
 * 但它同时是三个特性的机制：
 *
 * 1. **加载时把走廊画出来**（进度推进 → 地板 → 墙 → 门依次被画上色）
 * 2. **看过的永久上色**（墨迹记忆：回访时一眼看出哪些看过）
 * 3. **第二圈全上色**（段门上写着 `while(true) { explore(); }`，第二圈该不一样）
 *
 * 而 `uProgress` **只有一个**。三处各写就是三个写者抢一个 uniform：先写后写
 * 互相覆盖，表现为闪烁；而且"别人是不是也在写"这件事没有任何测试守得住。
 *
 * 取 `max` 的语义是「墨迹只会更浓，不会变淡」——这正好也是用户对"被画出来"
 * 的直觉，且让单调性可测（`__tests__/corridorInk.test.ts`）。
 *
 * ## 悬停为什么也走这里
 *
 * 悬停是瞬态的、组件本地的（不进 store），但它必须与其他三个来源**比大小**：
 * 一扇已经记住的门（1）被悬停（0.6）时不该变淡。让它作为参数进来而不是在
 * 组件里 `Math.max` 一下，是为了让这条规则只有一个地方。
 */

/**
 * 加载显形的窗口宽度 = 步长的多少倍。
 *
 * 1 = 一个画完才开始下一个（看起来是一格一格跳）；2 = 相邻两个的窗口重叠一半，
 * 视觉上连成一笔。取 2。
 */
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

/**
 * 加载显形的顺序：越靠近入口的地标越早被画出来。
 *
 * 按 `|relativeZ|` 升序 —— 走廊朝 −Z 延伸，所以 `relativeZ` 更大（更接近 0）
 * 的地标离入口更近。用户看着走廊从脚下往远处被画出来，与相机朝向一致。
 */
const LOAD_ORDER: readonly string[] = [...inkableLandmarkIds()].sort((a, b) => {
  const za = landmarkById(a)?.relativeZ ?? 0
  const zb = landmarkById(b)?.relativeZ ?? 0
  return zb - za // 负数：−8 排在 −56 之前
})

const ORDER_INDEX = new Map(LOAD_ORDER.map((id, index) => [id, index]))

/**
 * 加载期「画出走廊」的时间窗（规格 lab-corridor-story.md §1，决定 D）：
 * 进度到 30% 纸撕开、开始画，90% 画完；之后的 10% 是尾巴（字体 / 音频等不影响画面的资源）。
 */
export const INTRO_TEAR_AT = 0.3
export const INTRO_DRAWN_AT = 0.9

/** 把加载进度（0–1）映射到"画出来"的总量（0–1）：30% 前为 0，90% 后为 1 */
export function introDrawLevel(loadProgress: number): number {
  const p = clamp01(loadProgress)
  return clamp01((p - INTRO_TEAR_AT) / (INTRO_DRAWN_AT - INTRO_TEAR_AT))
}

/** 地标在加载序列里的序号（0 起）。未知 id 返回 −1 */
export function loadInkOrder(id: string): number {
  return ORDER_INDEX.get(id) ?? -1
}

/**
 * 加载过场里，这个地标此刻被"画"到什么程度。
 *
 * ## 它**不参与** `inkLevel`
 *
 * ADR 20260908172231 的索引原本把公式写成
 * `max(加载, 记忆, 圈数, 悬停)`。实现时发现那是错的：加载进度在加载完成后
 * **恒为 1**，于是 `max` 会让走廊里所有门永久上色 —— "只有看过的才上色"
 * 这个效果直接失效，而它正是墨迹记忆的全部意义。
 *
 * 加载显形是**一段过场表演**（纸撕开之前，走廊被一笔笔画出来），演完就该
 * 退回稳态；稳态由记忆 / 圈数 / 悬停决定。所以它单独导出，由那段过场动画
 * 自己驱动材质，不进 `inkLevel`。ADR 的索引已追加注记。
 *
 * 每个地标占一个进度窗口 `[t0, t0 + width]`，窗口宽度是步长的
 * `INK_LOAD_OVERLAP` 倍，因此相邻地标的窗口重叠、视觉上连成一笔。
 * 首个地标的窗口从 0 开始、末个在 1 结束 —— 「进度 0 全是草稿、进度 1 全部
 * 上色」这两条边界天然成立。
 *
 * **状态：已定义、未接线**（ADR 20260903211338 要求这样标注）。接线要连带
 * 决定 loader 的遮挡时机（`LabLoader` 现在是 `z-index 9999` 的纸盖住一切，
 * 走廊被画出来的过程看不见），那是一个产品决定，见
 * `docs/architecture/lab-corridor-world.md` §8 的 D。
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
export function inkLevel(id: string, inputs: InkInputs): number {
  if (inputs.inked.has(id)) return 1
  const lap = Number.isFinite(inputs.lap) ? inputs.lap : 0
  if (lap >= 1) return 1
  return clamp01(inputs.hover ?? 0)
}
