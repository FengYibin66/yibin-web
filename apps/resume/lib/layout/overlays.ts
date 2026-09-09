/**
 * 屏幕边缘的槽位声明表（ADR 20260909182319）。
 *
 * ## 这张表管什么
 *
 * 「钉在屏幕角上、不随页面滚动的小挂件」：返回链接、语言/主题开关、底部提示条、
 * 成就气泡、水印。它们的共同点是**各占一个角**。
 *
 * ## 这张表**不**管什么（必须写清，否则下一个人会以为它管住了所有布局）
 *
 * - **全屏覆盖层**：`LabLoader`(z 9999)、`PaperTransition`(9998)、`LabTutorial`(200)、
 *   `NavigationUI` 的 `inset:0` 容器(50)。它们的语义是「盖住一切」而不是「占一个角」，
 *   重新定序有真实风险（把纸过场排到 loader 之下画面就错），而 `lab.spec.ts` 那 61 条
 *   断言读的是 `data-lab-*` 属性、**对 z 序完全失明**——改错了没有任何测试会红。
 *   ADR 明确把它们划为「第二期，不做」。它们仍在 `OVERLAY_ROOT_Z` 之上，
 *   所以本表内的挂件永远压不住它们。
 * - **流内布局**。education 详情页标题被挤成 31px、字形越出自身盒 137px 那类缺陷
 *   与浮层冲突无关，规则在 `apps/resume/AGENTS.md` 的 flex 一节。
 *
 * ## 为什么需要它
 *
 * 此前全站 15 处 `position: fixed` 各自写坐标与 z 值（15 个互不共享的数），
 * 四个角是无主的共享资源，撞不撞取决于内容宽度。2026-09-09 审计实测出四个实例，
 * 其中一个在**桌面**上（入口页的域名水印被 ExplorerBar 100% 盖住，从上线那天起
 * 没人见过）——证明这与「手机」无关，只与「共享资源没有所有权」有关。
 *
 * 而这个仓库已经为同一个抽象缺失付过一次钱：`globals.css` 里
 * `.achievement-popup { bottom: 88px }` 的注释写着 `88 = 32（提示的底距）+
 * 提示自身高度（约 20）+ 一段间距`——一个组件手算另一个组件的高度。
 */

// ── 层序 ──────────────────────────────────────────────────────────────────────

/**
 * 有序的层。**z 值由下标派生，不手写数字**——这一条独立地消灭了原先那 15 个魔数。
 *
 * 顺序即层序：靠后的压住靠前的。加新层要想清楚它该插在哪，而不是随手取一个更大的数。
 */
export const OVERLAY_LAYERS = [
  /** 提示性文字：可被任何东西盖住而不损失功能（滚动提示、水印） */
  'hint',
  /** 常驻控件：返回、语言、主题、导航按钮 */
  'chrome',
  /** 展开的面板：地图、音频、成就 */
  'panel',
  /** 短暂弹出：成就气泡 */
  'popup',
  /** 字幕：路线导览的解说，必须压住上面所有的 */
  'caption',
] as const

export type OverlayLayer = (typeof OVERLAY_LAYERS)[number]

/**
 * 整张表所处的 z。
 *
 * 本表内的挂件全部活在这一个层叠上下文里，所以：
 * - 页面内容（现状最高 z=40）永远在它们之下
 * - 全屏覆盖层（200 / 9998 / 9999，见文件头「不管什么」）永远在它们之上
 *
 * 这个「夹在中间」的位置是刻意的：既不用逐个调页面内容的 z，也不必冒险给
 * 全屏层重新定序。
 */
export const OVERLAY_ROOT_Z = 50

/** 层内 z。同层的多个挂件不该靠 z 分先后——它们要么不同槽位，要么是 flex 兄弟 */
export function zOfLayer(layer: OverlayLayer): number {
  const i = OVERLAY_LAYERS.indexOf(layer)
  if (i < 0) throw new Error(`未声明的层：${layer}`)
  return (i + 1) * 10
}

// ── 槽位 ──────────────────────────────────────────────────────────────────────

/**
 * 九个锚点。`direction` 是同槽位内多个挂件的排布方向——**这是「几何上不可能重叠」
 * 的实现方式**：同槽位的占位者是同一个 flex 容器的兄弟，不是各自绝对定位。
 *
 * `inset` 只给一个基准值，实际还要叠 `env(safe-area-inset-*)`（刘海屏与手势条）。
 * 原先四个角的内边距有 16/20/24/32 四种写法，没有共识。
 */
export const EDGE_SLOTS = {
  /**
   * 贯通整行的顶栏。**这是唯一 `col: 'stretch'` 的槽位，存在理由是跨槽位重叠。**
   *
   * 「同槽位是 flex 兄弟所以不可能重叠」只对同一个槽位成立。Lab 顶栏原先是
   * `top-left` 的 `← Exit Lab`（20→104）与 `top-right` 的六个图标（24→304）——
   * **两个不同槽位**，在 320px 上实测重叠 80px。把它们放进同一行、
   * `space-between` 分列两端，才真的变成兄弟。
   *
   * 起草 ADR 时我把 A4 写成「这个抽象自然修掉」，那是不准确的：
   * 分处两角的两组挂件，抽象只统一了坐标来源，没有让它们互相知道对方多宽。
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

/** 槽位内边距（px）。窄屏更小——手机上 20px 的边距会白吃掉可视宽度 */
export const SLOT_INSET = { narrow: 12, wide: 16 } as const

/** 同槽位内相邻挂件的间距（px）。8 是触摸目标之间的最小可分辨间距 */
export const SLOT_GAP = 8

// ── 出现条件 ──────────────────────────────────────────────────────────────────

/**
 * 挂件何时在场。
 *
 * **这个字段必须存在**，因为同一个槽位合法地被多个挂件共用：Lab 走廊的
 * `← Exit Lab` 与房间内的返回按钮都在 `top-left`，靠 `isInRoom` 互斥。
 * 今天这个约定只活在两个 JSX 条件里，没有任何地方声明过它——
 * 声明出来，`overlayRegistry.test.ts` 才能断言「同槽位的两个占位者互斥」。
 */
export type OverlayPresence =
  | 'always'
  /** 仅宽屏（≥768）。窄屏上该功能有别的入口，或刻意不提供 */
  | 'desktop'
  /** 仅窄屏（<768） */
  | 'narrow'
  /** 仅首次访问（持久化在 localStorage，形态见 lib/lab/tutorialStorage.ts） */
  | 'first-visit'
  /**
   * 仅在房间内 / 仅在走廊。这一对是**互斥声明**：`overlayOwnership.test.ts` 据此
   * 允许两个挂件占同一槽位的同一个 `order`（Lab 的走廊退出链接与房间内返回按钮）。
   *
   * 与 `desktop` / `narrow` 不同，`EdgeItem` **判不了**它——房间状态在
   * `SceneContext` 里，而 `EdgeItem` 属于 layout 层、不该 import Lab 的 context
   * （分层方向单向朝内）。所以这两种 presence 的可见性由调用方经 `visible` 传入，
   * 声明的作用是让门禁能推理互斥。
   */
  | 'in-room'
  | 'not-in-room'

/**
 * 挂件所属的页面。
 *
 * **不是分类标签，是门禁的必要输入。** 「同槽位的两个挂件必须可证互斥或 order 不同」
 * 这条断言在跨页面时会误报：入口页的底部提示与 Lab 走廊的滚动提示都是
 * `bottom-center` / `order: 10`，而它们永远不会同时存在——不是因为互斥条件，
 * 是因为**它们在两个不同的页面上**。
 *
 * 没有这个字段，门禁只有两条路：要么误报（然后被人加豁免，
 * `.claude/hooks/AGENTS.md`：「误报会训练人绕过守卫，那比漏报更危险」），
 * 要么放弃这条断言。
 */
export type OverlaySurface =
  /** 门户 `/`（左 Lab 右 Classic 那一屏） */
  | 'entry'
  /** `/lab` 走廊与房间 */
  | 'lab'

export interface OverlayEntry {
  /** 稳定标识。也是 DOM 上的 `data-overlay` 值，E2E 靠它定位 */
  readonly id: string
  readonly surface: OverlaySurface
  readonly slot: EdgeSlot
  readonly layer: OverlayLayer
  readonly presence: OverlayPresence
  /**
   * 同槽位内的排序权重（小的在前）。用 CSS `order` 实现，
   * 因为 React portal 的挂载顺序不确定，不能依赖 DOM 顺序。
   */
  readonly order: number
  /**
   * 是否接收指针事件。
   *
   * **必须显式声明，不能从 `layer` 推断。** 我第一版让 `EdgeItem` 的包装层
   * 无条件 `pointerEvents: 'auto'`，结果入口页那条提示（它自己写着 `none`）
   * 被包装层盖掉，从「视觉遮挡但点得穿」变成**真的挡住主按钮**——
   * 实测点击不跳转，比它原来的样子更糟。
   *
   * 而按 `layer === 'hint'` 推断也会错：路线引导那批要加的 coach mark
   * 就是一个**可点的提示**（点它直接开始导览）。是不是装饰与在哪一层无关。
   */
  readonly interactive: boolean
  /** 一句话说明它是什么，供读表的人不必跳文件 */
  readonly what: string
}

/**
 * 注册表。**只登记 `EdgeLayer` 真正渲染的挂件**——
 * 「已定义未接线」在本仓库是债务（ADR 20260903211338），
 * `overlayRegistry.test.ts` 会断言每条都有生产消费者。
 *
 * Lab 的挂件已在第二批收编。仍**不在**表内的是全屏覆盖层（见文件头「不管什么」）。
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
    what: '入口页右上的语言切换（语言在入口定，进 Lab / Classic 都沿用）',
  },
  {
    id: 'entry-audio',
    surface: 'entry',
    slot: 'top-right',
    layer: 'chrome',
    presence: 'always',
    order: 20,
    interactive: true,
    what: '入口页右上的静音开关。原先它是 ExplorerBar 文本里的 [ON/OFF]——'
      + '那是那条提示里唯一的交互元素，所以提示要能淡出，必须先把它挪出来',
  },
  {
    id: 'entry-explorer-hint',
    surface: 'entry',
    slot: 'bottom-center',
    layer: 'hint',
    presence: 'first-visit',
    order: 10,
    interactive: false,
    what: '入口页底部的「点一扇门进入」提示。原先常驻，100% 盖住 Classic 面板的'
      + '「打开简历」按钮；现在只首访出现并自动淡出',
  },
  // ── Lab（第二批收编：顶栏与底部）──────────────────────────────────────────
  {
    id: 'lab-exit',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'not-in-room',
    order: 10,
    interactive: true,
    what: '走廊左上的「← 退出 Lab」。原先 LabScene 自己 fixed 到 (20,20)，'
      + '与右上那排图标分属两个槽位，320px 上实测重叠 80px',
  },
  {
    id: 'lab-room-back',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'in-room',
    order: 10,
    interactive: true,
    what: '房间内的返回按钮。与 lab-exit 同槽同 order，靠 in-room / not-in-room 互斥'
      + '——这个约定原先只活在两个 JSX 条件里，没有任何地方声明过',
  },
  {
    id: 'lab-nav',
    surface: 'lab',
    slot: 'top-bar',
    layer: 'chrome',
    presence: 'always',
    order: 20,
    interactive: true,
    what: 'Lab 顶栏右侧的导航图标排（路线 / 地图 / 音频 / 成就 / 帮助 / 语言）。'
      + '窄屏折成三个：路线 + 地图 + 更多',
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
    what: '成就气泡。**这是本表存在理由的原型**：它原先在 globals.css 里写死'
      + ' bottom: 88px，注释逐字写着「88 = 32（提示的底距）+ 提示自身高度（约 20）'
      + '+ 一段间距」——一个组件手算另一个组件的高度。现在它与 lab-scroll-hint 是'
      + '同一个 column flex 的兄弟，那个数消失了',
  },
  {
    id: 'entry-watermark',
    surface: 'entry',
    slot: 'bottom-left',
    layer: 'hint',
    presence: 'desktop',
    order: 10,
    interactive: false,
    what: '入口页的域名水印。原先与 ExplorerBar 逐字同坐标（bottom:16 居中）、'
      + 'z 差 70，桌面上 100% 被盖住，从 ExplorerBar 上线那天起没人见过',
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
