/**
 * 屏幕边缘的槽位声明表（ADR 20260909182319）。
 *
 * 管「钉在屏幕角上、不随页面滚动的小挂件」——共同点是**各占一个角**。
 *
 * **不管**两类东西，写清以免被当成已覆盖：
 * - **全屏覆盖层**（`LabLoader` 9999 / `PaperTransition` 9998 / `LabTutorial` 200 /
 *   `NavigationUI` 的 `inset:0` 容器 50）。语义是「盖住一切」而非「占一个角」，
 *   ADR 划为第二期。它们仍在 `OVERLAY_ROOT_Z` 之上，本表的挂件压不住它们。
 * - **流内布局**。规则在 `apps/resume/AGENTS.md` 的 flex 一节。
 */

// ── 层序 ──────────────────────────────────────────────────────────────────────

/** 有序的层，**z 由下标派生**。顺序即层序：靠后的压住靠前的 */
export const OVERLAY_LAYERS = [
  /** 提示性文字：可被盖住而不损失功能（滚动提示、水印） */
  'hint',
  /** 常驻控件：返回、语言、主题、导航按钮 */
  'chrome',
  /** 展开的面板：地图、音频、成就 */
  'panel',
  /** 短暂弹出：成就气泡 */
  'popup',
  /** 字幕：路线导览的解说，压住以上全部 */
  'caption',
] as const

export type OverlayLayer = (typeof OVERLAY_LAYERS)[number]

/**
 * 整张表所处的 z。夹在中间是刻意的：页面内容（最高 40）永远在下，
 * 全屏覆盖层（200 / 9998 / 9999）永远在上。
 */
export const OVERLAY_ROOT_Z = 50

/** 层内 z。同层的挂件不靠 z 分先后——要么不同槽位，要么是 flex 兄弟 */
export function zOfLayer(layer: OverlayLayer): number {
  const i = OVERLAY_LAYERS.indexOf(layer)
  if (i < 0) throw new Error(`未声明的层：${layer}`)
  return (i + 1) * 10
}

// ── 槽位 ──────────────────────────────────────────────────────────────────────

/**
 * 九个锚点。`direction` 是同槽位内的排布方向——同槽位的占位者是同一个 flex
 * 容器的兄弟而非各自绝对定位，所以几何上不可能重叠。
 */
export const EDGE_SLOTS = {
  /**
   * 贯通整行的顶栏，唯一的 `col: 'stretch'`。
   *
   * 「同槽位是 flex 兄弟所以不重叠」**只对同一个槽位成立**。分处 top-left 与
   * top-right 的两组挂件互不知道对方多宽（Lab 顶栏 320px 上实测撞 80px）。
   * 要在一行里放两组东西就用这个槽位。
   */
  'top-bar':       { row: 'top',    col: 'stretch', direction: 'row'   },
  'top-left':      { row: 'top',    col: 'left',   direction: 'row'    },
  'top-center':    { row: 'top',    col: 'center', direction: 'row'    },
  'top-right':     { row: 'top',    col: 'right',  direction: 'row'    },
  'middle-left':   { row: 'middle', col: 'left',   direction: 'column' },
  'middle-right':  { row: 'middle', col: 'right',  direction: 'column' },
  'bottom-left':   { row: 'bottom', col: 'left',   direction: 'row'    },
  'bottom-center': { row: 'bottom', col: 'center', direction: 'column' },
  'bottom-right':  { row: 'bottom', col: 'right',  direction: 'row'    },
} as const

export type EdgeSlot = keyof typeof EDGE_SLOTS

/** 槽位内边距（px）。实际还要叠 `env(safe-area-inset-*)` */
export const SLOT_INSET = { narrow: 12, wide: 16 } as const

/** 同槽位内相邻挂件的间距（px） */
export const SLOT_GAP = 8

// ── 出现条件 ──────────────────────────────────────────────────────────────────

/** 挂件何时在场。门禁靠它证明同槽位的两个占位者互斥 */
export type OverlayPresence =
  | 'always'
  /** 仅宽屏（≥768） */
  | 'desktop'
  /** 仅窄屏（<768） */
  | 'narrow'
  /** 仅首次访问（持久化在 localStorage） */
  | 'first-visit'
  /**
   * 仅在房间内 / 仅在走廊，是一对**互斥声明**。
   *
   * `EdgeItem` 判不了它（房间状态在 `SceneContext`，layout 层不该 import Lab 的
   * context），所以可见性由调用方经 `visible` 传入。
   */
  | 'in-room'
  | 'not-in-room'

/**
 * 挂件所属页面。**不是分类标签，是门禁的必要输入**：入口页的底部提示与 Lab 的
 * 滚动提示都是 `bottom-center` / `order: 10`，判成冲突是误报——它们在两个页面上。
 */
export type OverlaySurface =
  /** 门户 `/` */
  | 'entry'
  /** `/lab` 走廊与房间 */
  | 'lab'

export interface OverlayEntry {
  /** 稳定标识，也是 DOM 上的 `data-overlay` 值 */
  readonly id: string
  readonly surface: OverlaySurface
  readonly slot: EdgeSlot
  readonly layer: OverlayLayer
  readonly presence: OverlayPresence
  /** 同槽位内的排序权重（小的在前）。用 CSS `order`——portal 的挂载顺序不确定 */
  readonly order: number
  /**
   * 是否接收指针事件。**必须显式声明，不能从 `layer` 推断**：`hint` 层里既有
   * 纯装饰的水印，也有可点的路线引导；推错会让浮层真的挡住底下的按钮。
   */
  readonly interactive: boolean
  /** 一句话说明它是什么 */
  readonly what: string
}

/**
 * 注册表。只登记 `EdgeLayer` 真正渲染的挂件——「已定义未接线」在本仓库是债务
 * （ADR 20260903211338），门禁会断言每条都有生产消费者。
 */
export const OVERLAY_REGISTRY: readonly OverlayEntry[] = [
  {
    id: 'entry-locale',
    surface: 'entry',
    slot: 'top-right',
    layer: 'chrome',
    presence: 'always',
    order: 10,
    interactive: true,
    what: '入口页右上的语言切换',
  },
  {
    id: 'entry-audio',
    surface: 'entry',
    slot: 'top-right',
    layer: 'chrome',
    presence: 'always',
    order: 20,
    interactive: true,
    what: '入口页右上的静音开关',
  },
  {
    id: 'entry-explorer-hint',
    surface: 'entry',
    slot: 'bottom-center',
    layer: 'hint',
    presence: 'first-visit',
    order: 10,
    interactive: false,
    what: '入口页底部的「点一扇门进入」提示',
  },
  {
    id: 'entry-watermark',
    surface: 'entry',
    slot: 'bottom-left',
    layer: 'hint',
    presence: 'desktop',
    order: 10,
    interactive: false,
    what: '入口页的域名水印',
  },
  {
    id: 'lab-exit',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'not-in-room',
    order: 10,
    interactive: true,
    what: '走廊左上的「← 退出 Lab」',
  },
  {
    id: 'lab-room-back',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'in-room',
    order: 10,
    interactive: true,
    what: '房间内的返回按钮。与 lab-exit 同槽同 order，靠 in-room / not-in-room 互斥',
  },
  {
    id: 'lab-nav',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'always',
    order: 20,
    interactive: true,
    what: 'Lab 顶栏右侧的导航图标排；窄屏折成路线 + 地图 + 更多',
  },
  {
    id: 'lab-scroll-hint',
    surface: 'lab',
    slot: 'bottom-center',
    layer: 'hint',
    presence: 'not-in-room',
    order: 10,
    interactive: false,
    what: '走廊底部的「滚动 / 上下滑」提示',
  },
  {
    id: 'lab-achievement',
    surface: 'lab',
    slot: 'bottom-center',
    layer: 'popup',
    presence: 'always',
    order: 20,
    interactive: false,
    what: '成就气泡。与 lab-scroll-hint 同槽的 column flex 兄弟——'
      + '它原先在 CSS 里手算另一个组件的高度（`bottom: 88px`）',
  },
]

/** 按 id 取。找不到就抛——静默返回 undefined 会让挂件悄悄不渲染 */
export function overlayById(id: string): OverlayEntry {
  const entry = OVERLAY_REGISTRY.find(e => e.id === id)
  if (!entry) {
    throw new Error(
      `未在 OVERLAY_REGISTRY 声明的浮层 id：${id}。`
      + `新增屏角挂件要先在 lib/layout/overlays.ts 登记（含 slot / layer / presence）。`,
    )
  }
  return entry
}

/** 某槽位的全部占位者，已按 order 排好 */
export function overlaysInSlot(slot: EdgeSlot): readonly OverlayEntry[] {
  return OVERLAY_REGISTRY.filter(e => e.slot === slot).sort((a, b) => a.order - b.order)
}
