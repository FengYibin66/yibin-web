/**
 * 手写层的类型 —— 「画什么」的声明，与「怎么画」彻底分开。
 *
 * 分开的理由（ADR 20260903140619 选项 C）：便签、白板高亮、机柜、刻度盘、
 * 电缆这类元素需要「同一风格的无数变体」。预制位图会让纹理数量爆炸——每个
 * 项目一张便签是 8 张，加 hover 态 16 张——而它们本质上是程序化可生成的。
 *
 * 分层：
 *
 *   SketchSpec（本文件）    声明式：一张便签、一块白板、一个机柜
 *        │  planSketch()    纯函数，无 canvas、无 DOM
 *        ▼
 *   SketchOp[]              图元序列：矩形、线、多边形、文字
 *        │  infra/sketch    roughjs 执行 → CanvasTexture
 *        ▼
 *   THREE.CanvasTexture
 *
 * 中间那层图元序列是可完全单测的：不需要 canvas 就能断言「一张便签画了外框 +
 * 折角 + N 行文字」。手绘抖动交给 roughjs，我们不自己搓——它就是 Excalidraw
 * 的渲染引擎，风格与 Lab 的铅笔线稿同源。
 */

/** Lab 的墨色。走廊线稿、门贴纸、纸板全用这一个色，手写层必须对齐 */
export const INK = '#2a1f0e'

/** 便签的纸色（暖黄，与米色纸板区分但不跳） */
export const STICKY_PAPER = '#f2e3b8'

/** 白板底色（冷白，与纸板的暖米色对比，暗示它是另一种材质） */
export const BOARD_PAPER = '#e8e6df'

/** 手写字体族。`app/globals.css` 里有对应 `@font-face` */
export const HAND_FONT = "'Patrick Hand', 'CabinSketch', cursive"

// ─── 图元 ─────────────────────────────────────────────────────────────────────

export interface OpStyle {
  stroke: string
  strokeWidth: number
  /** 不填就是空心 */
  fill?: string
  /** roughjs 的填充笔法。`solid` 是实心，其余是手绘排线 */
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots'
  /** 0 = 精确，1 = 默认手绘感，2+ = 潦草 */
  roughness: number
  /** 线条整体的弯曲程度 */
  bowing: number
  /**
   * roughjs 的随机种子。**必须显式给**：不给的话每次调用抖动都不一样，
   * 同一个 spec 重新栅格化会得到肉眼可见的不同结果（纹理"跳"一下）。
   * 由 `seedFrom()` 从 spec 的身份派生，所以同 spec 必得同图。
   */
  seed: number
}

export type SketchOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; style: OpStyle }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; style: OpStyle }
  | { kind: 'polygon'; points: readonly (readonly [number, number])[]; style: OpStyle }
  | { kind: 'ellipse'; cx: number; cy: number; w: number; h: number; style: OpStyle }
  | { kind: 'curve'; points: readonly (readonly [number, number])[]; style: OpStyle }
  | {
      kind: 'text'
      x: number
      y: number
      text: string
      size: number
      color: string
      align: 'left' | 'center' | 'right'
      /** 手写感：整行轻微倾斜（弧度） */
      rotate?: number
    }

// ─── 声明 ─────────────────────────────────────────────────────────────────────

/** 画布尺寸。纹理要贴到平面上，长宽比得和平面一致 */
export interface SketchSize {
  width: number
  height: number
}

/** 便签：项目卡旁的手写标签 */
export interface StickySpec {
  kind: 'sticky'
  /** 参与种子派生，同时是缓存键的一部分 */
  id: string
  size: SketchSize
  title: string
  /** 正文行。不做自动折行——折行在声明侧决定，渲染侧不猜 */
  lines: readonly string[]
  paper?: string
  /** 图钉画在顶边中点 */
  pinned?: boolean
}

/** 白板：架构图的底板（网格 + 边框 + 托盘） */
export interface BoardSpec {
  kind: 'board'
  id: string
  size: SketchSize
  title?: string
  /** 网格间距（px）。0 = 不画网格 */
  grid?: number
}

/** 机柜：服务器机架，槽位 + 状态灯位 */
export interface CabinetSpec {
  kind: 'cabinet'
  id: string
  size: SketchSize
  /** 槽位数 */
  slots: number
  /** 每个槽位画几个灯 */
  lampsPerSlot?: number
}

/** 刻度盘：墙上的仪表 */
export interface DialSpec {
  kind: 'dial'
  id: string
  size: SketchSize
  /** 刻度数 */
  ticks: number
  /** 指针位置，0..1 */
  value: number
  label?: string
}

/** 胶带标签：贴在设备上的手写条 */
export interface TapeSpec {
  kind: 'tape'
  id: string
  size: SketchSize
  text: string
  paper?: string
}

/** 电缆：两点之间的垂链，画在墙面纹理上 */
export interface CableSpec {
  kind: 'cable'
  id: string
  size: SketchSize
  /** 归一化坐标 0..1，避免声明里出现像素 */
  from: readonly [number, number]
  to: readonly [number, number]
  /** 下垂量，占画布高度的比例 */
  sag?: number
  /** 几根并排 */
  strands?: number
}

export type SketchSpec =
  | StickySpec
  | BoardSpec
  | CabinetSpec
  | DialSpec
  | TapeSpec
  | CableSpec

/**
 * spec 的身份 —— 缓存键与随机种子都从这里派生。
 *
 * 用 `kind:id` 而不是整个对象的 JSON：id 由调用侧显式给，改文案不该让整块
 * 纹理换一副抖动（那会让人以为渲染不稳定）。反过来说，**改了尺寸或内容
 * 却不改 id，缓存不会失效**——这是有意的权衡，声明是构建期常量。
 */
export function specKey(spec: SketchSpec): string {
  return `${spec.kind}:${spec.id}`
}

/**
 * 从字符串派生一个稳定的 32 位种子（FNV-1a）。
 *
 * 需要"稳定"是因为 roughjs 的 seed 决定抖动形状：同一个 spec 在两次会话、
 * 两台机器上必须得到同一张图，否则纹理缓存（按 specKey 命中）与实际图像
 * 就不是一回事了。`Math.random()` 或 `Date.now()` 都不行。
 */
export function seedFrom(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // roughjs 的 seed 要正整数
  return (hash >>> 0) % 2147483647 || 1
}
