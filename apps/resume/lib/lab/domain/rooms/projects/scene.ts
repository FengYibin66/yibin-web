/**
 * Projects 房间的空间声明 —— 「深夜实验室」（ADR 20260903140619）。
 *
 * 这个文件是**数据**：墙在哪、桌子多大、白板挂在哪面墙、机柜几个槽、
 * 便签贴哪、电缆从哪走到哪。视图组件（`components/rooms/projects/**`）只
 * 遍历这些声明去画，不自己决定坐标。
 *
 * 为什么要这样：原先的 Projects 房间是「一座塔 + 一组粒子」，坐标散在
 * 组件里的十几个魔数中（`TOWER_RADIUS`、`TOWER_Z_START`、`CAMERA_Y_OFFSET`
 * …），而相机取景在**另一个**文件里靠另一组魔数猜。审计 A4 就是这两组数
 * 对不上——相机离塔 13 单位而不是意图的 6。坐标只有一个来源，才谈得上
 * 「取景对不对」是可验证的。
 *
 * ## 两个坐标系
 *
 * 本文件里的坐标是**桌心坐标系**：原点在工作台中心，+Z 朝门（朝观察者），
 * +Y 朝上。这样写起来自然——"显示器在台心前方 3.4"。
 *
 * 但 `RoomDefinition.entryPose` 用的是**门坐标系**：那是房间根 group 所在的
 * 空间，它的原点在门平面上、**+Z 指向门外（走廊一侧）**。所以房间内容全部
 * 位于 z 负半轴，`entryPose.position[2]` 也必须是负数。
 *
 * `ROOM_ORIGIN_Z` 是两者的唯一关联：桌心坐标系原点在门坐标系里的 z。
 *
 * 这个区分不是洁癖。第一版把整间房建在桌心坐标系上、直接把它当门坐标系用，
 * 于是 `entryPose` 的 `z: 1.9` 落在**门外的走廊里**——实机探针读出相机在
 * 世界 x=1.61 而走廊墙在 x=3.5，画面里只有一面贴着脸的墙。审计 A4 的根因
 * 也是同一类：分不清哪个坐标系。
 */

import type { SketchSpec } from '../../sketch/types'

// ─── 房间外壳 ────────────────────────────────────────────────────────────────

/** 地板与天花的高度。与走廊一致，因为这是同一栋楼里的一间房 */
export const FLOOR_Y = -1.75
export const CEILING_Y = 2.75

/** 房间尺寸：宽（x）× 深（z）。比走廊宽，容得下三面墙各有内容 */
export const ROOM_WIDTH = 11
export const ROOM_DEPTH = 10.5

/**
 * 桌心坐标系原点在**门坐标系**里的 z。
 *
 * 门平面在门坐标系的 z=0，房间往 −Z 延伸。这个值把桌心放在房间进深的中间
 * 偏门一侧（−5.6 而不是 −5.25），留 0.35 的门槛间隙：前沿正好落在 z=−0.35，
 * 不与门平面共面。
 *
 * 视图侧只有一处用它——`ProjectsRoom` 把全部内容包在
 * `<group position={[0, 0, ROOM_ORIGIN_Z]}>` 里。其余组件一律用桌心坐标。
 */
export const ROOM_ORIGIN_Z = -5.6

/** 墙面位置（桌心坐标系） */
export const WALL_X = ROOM_WIDTH / 2
export const BACK_Z = -ROOM_DEPTH / 2
/** 门所在的那面（+Z）。留开口，不画满 */
export const FRONT_Z = ROOM_DEPTH / 2

/** 桌心坐标 → 门坐标（`entryPose` 等声明用的那个空间） */
export function toDoorFrame(
  local: readonly [number, number, number],
): [number, number, number] {
  return [local[0], local[1], local[2] + ROOM_ORIGIN_Z]
}

// ─── 工作台 ──────────────────────────────────────────────────────────────────

/**
 * 环形工作台。显示器沿它的外缘排布。
 *
 * 环形而不是一字排开：房间要能「环视」（`cameraFreedom.azimuth ±0.6`），
 * 一字排开时侧看就是一排薄片。
 */
export const DESK = {
  /** 台面外半径。必须大于 `MONITOR_RING.radius`，否则显示器悬在台外 */
  outerRadius: 3.75,
  /** 中间留空 —— 观察者就站在这个洞里 */
  innerRadius: 2.05,
  /** 台面高度 */
  y: -0.55,
  thickness: 0.12,
  /**
   * 缺口朝门，方便「走进去」。单位弧度，以 +Z 为中心。
   * 0 表示完整圆环。
   */
  gap: 1.1,
} as const

/** 显示器排布 */
export const MONITOR_RING = {
  /**
   * 显示器中心到房间中心的距离。
   *
   * 3.0 不是随手取的：8 块铺满 ±0.56π 的弧，相邻角距 = 3.518/7 ≈ 0.503 rad，
   * 弦长 = 2·r·sin(0.2513)。r=2.55 时弦长只有 1.28 < 屏宽 1.42 —— **物理上
   * 互相穿插**。r=3.0 时弦长 1.49，留出余量。
   * （这是被 projectsScene 的"相邻弧长 > 屏宽"那条测试抓出来的。）
   */
  radius: 3.4,
  /** 屏幕中心高度 */
  y: 0.12,
  /**
   * 屏幕尺寸（世界单位）。
   *
   * 1.42×0.92 摆不下 6 块：可见弧最多 ±0.87 rad（再宽外缘就被画面切掉），
   * 在半径 3.4 上相邻弦长只有 1.18 < 1.42，**物理互相穿插**；加大半径能解
   * 穿插但又把外缘推出画面。两个约束夹住之后，唯一的解是把屏幕做小。
   * 1.12×0.73 保持原来的 1.54 宽高比，弦长 1.18 > 1.12 有余量，
   * 顺带也不再像原来那样压满画面下半。
   */
  width: 1.12,
  height: 0.73,
  depth: 0.11,
  /**
   * 排布的角度范围。**0° 指向后墙（−Z），也就是背对门的方向。**
   *
   * 这个基准很关键。第一版把 0° 定在 +Z（朝门），于是 `arc` 中点的那块
   * 显示器落在观察者与房间中心之间——从 `entryPose` 看过去它就在脸前 1.4
   * 单位处，挡住整个房间。实机截图立刻看出来了。
   *
   * 现在的构图是「坐在弧形工作台的圆心」：观察者在 +Z 一侧的台面缺口处，
   * 显示器沿 −Z 半侧排开，全部在视野前方。
   *
   * ±60° 而不是 ±100°：60° 垂直 FOV 在 16:9 下水平半视角约 46°，±100° 的
   * 两端要转头才看得到，而 `cameraFreedom.azimuth` 只有 ±0.6 rad（±34°）。
   * 声明的排布范围超出可视 + 可转范围，等于声明了看不见的东西。
   */
  /*
    ±0.87 rad（±49.8°）。

    ±60° 时最外两块的**外缘**投到 NDC ±1.07——中心在画面内、边缘被切掉。
    实机截图看得到，而只验中心点的断言是绿的（测试太松，不是代码对）。
  */
  arc: [-0.87, 0.87] as const,
  /** 显示器最多几块。超出的项目不进这个房间 */
  max: 6,
} as const

/** 单块显示器停靠（点击查看）时相对它自身的观察位姿 */
export const MONITOR_DOCK = {
  /** 相机停在屏幕正前方多远 */
  distance: 1.35,
  /** 视线略微低于屏幕中心，像坐着看 */
  targetYOffset: -0.04,
  duration: 0.75,
} as const

// ─── 墙面陈设 ────────────────────────────────────────────────────────────────

export type WallFace = 'back' | 'left' | 'right'

/** 贴在墙上的一块手绘面板 */
export interface WallPanel {
  id: string
  face: WallFace
  /** 沿墙面的横向偏移（back 墙是 x，侧墙是 z） */
  along: number
  /** 中心高度 */
  y: number
  /** 世界尺寸 */
  width: number
  height: number
  /** 轻微倾斜，弧度。手贴的东西不会正 */
  tilt?: number
  /**
   * 额外离墙距离。
   *
   * 两块面板在墙上重叠时必须分层，否则同一深度会 z-fighting（画面闪）。
   * 默认 0.02（基础离墙量），电缆这类"压在白板上方"的给更大的值。
   */
  lift?: number
  /** 画什么 */
  sketch: SketchSpec
}

/**
 * 白板：后墙的主视觉。
 *
 * 2048×1024 是纹理尺寸，不是世界尺寸；世界尺寸由 `width`/`height` 给。
 * 比例保持一致，否则手绘线条会被拉扁。
 */
export const WHITEBOARD: WallPanel = {
  id: 'whiteboard',
  face: 'back',
  along: -1.3,
  /*
    抬到 1.35、压成 2.67:1 的宽扁形。

    第一版是 5.4×2.7 居中在 y=0.72：**下半部分整个被显示器挡住**，架构图里
    auto-wechat 与 MySQL 两个框根本看不到（实机截图）。显示器上沿在 y≈0.49，
    所以白板下沿必须高于它。宽扁形正好——架构图本来就是横向的。
  */
  // 1.42：下沿 0.52 刚好高于显示器上沿 0.485（测试守这条）
  y: 1.42,
  width: 4.8,
  height: 1.8,
  tilt: 0.004,
  sketch: {
    kind: 'board',
    id: 'projects-whiteboard',
    size: { width: 1024, height: 384 },
    grid: 48,
  },
}

/**
 * 白板上的架构图。
 *
 * 内容是**这个站点自己的架构**（根 CLAUDE.md 的"仓库结构"与
 * ADR 20260822120801/120802 的那几条决定），不是通用示意图：三个应用同仓、
 * 共用一台 CVM 与一份 nginx，但**各有独立持久层**——portal 是 libSQL 单文件，
 * auto-wechat 才用 MySQL + Redis，跨应用的数据需求走接口不走数据库。
 *
 * 叠在白板上（`lift` 比白板大），所以是独立的一块面板而不是白板 spec 的一部分：
 * 白板底与图分层才能各自换。
 */
export const WHITEBOARD_DIAGRAM: WallPanel = {
  id: 'whiteboard-diagram',
  face: 'back',
  along: WHITEBOARD.along,
  y: WHITEBOARD.y,
  width: WHITEBOARD.width * 0.94,
  height: WHITEBOARD.height * 0.94,
  tilt: WHITEBOARD.tilt,
  lift: 0.03,
  sketch: {
    kind: 'diagram',
    id: 'projects-architecture',
    size: { width: 1024, height: 384 },
    title: 'yibinfeng.com',
    /*
      标题在 y=0.09，节点从 y=0.30 起——第一版标题 y=0.10 而 portal 框
      占 y 0.06..0.23，两者压在一起（实机截图能看到标题被框线穿过）。
    */
    nodes: [
      { id: 'dns', label: '访客', x: 0.07, y: 0.52, w: 0.10, h: 0.26, dashed: true },
      { id: 'nginx', label: 'nginx', sub: '一台 CVM', x: 0.24, y: 0.52, w: 0.14, h: 0.32 },
      { id: 'portal', label: 'portal', sub: 'Hono + React', x: 0.49, y: 0.30, w: 0.18, h: 0.28 },
      { id: 'resume', label: 'resume', sub: 'Next.js SSG', x: 0.49, y: 0.62, w: 0.18, h: 0.28 },
      { id: 'wechat', label: 'auto-wechat', sub: 'Go + Vue + Py', x: 0.49, y: 0.90, w: 0.21, h: 0.19 },
      { id: 'libsql', label: 'libSQL', sub: '单文件', x: 0.76, y: 0.30, w: 0.15, h: 0.24 },
      { id: 'mysql', label: 'MySQL / Redis', x: 0.79, y: 0.90, w: 0.20, h: 0.17 },
    ],
    edges: [
      { from: 'dns', to: 'nginx' },
      { from: 'nginx', to: 'portal' },
      { from: 'nginx', to: 'resume' },
      { from: 'nginx', to: 'wechat' },
      { from: 'portal', to: 'libsql' },
      { from: 'wechat', to: 'mysql' },
    ],
  },
}

/**
 * 便签：贴在白板右侧的墙面上。
 *
 * 内容留空——它由项目数据填充（`stickyForProject`），因为便签写的是当前
 * 停靠的那个项目的技术栈。这里只声明位置与尺寸。
 */
export const STICKY_SLOTS: readonly Omit<WallPanel, 'sketch'>[] = [
  // 两列两行，全部在显示器上沿（y≈0.49）之上——第一版下面两张
  // （y=0.32 / 0.05）整个被显示器挡住（实机截图）
  { id: 'sticky-0', face: 'back', along: 2.45, y: 1.85, width: 1.10, height: 0.84, tilt: -0.06 },
  { id: 'sticky-1', face: 'back', along: 3.75, y: 1.72, width: 1.00, height: 0.76, tilt: 0.08 },
  { id: 'sticky-2', face: 'back', along: 2.55, y: 0.98, width: 1.06, height: 0.80, tilt: 0.04 },
  { id: 'sticky-3', face: 'back', along: 3.85, y: 0.94, width: 0.98, height: 0.74, tilt: -0.05 },
]

/** 机柜：右墙。房间里唯一的动态光源（LED 呼吸） */
export const CABINET: WallPanel = {
  id: 'cabinet',
  face: 'right',
  along: -1.6,
  y: 0.1,
  width: 2.9,
  height: 3.4,
  sketch: {
    kind: 'cabinet',
    id: 'projects-rack',
    size: { width: 384, height: 448 },
    slots: 7,
    lampsPerSlot: 3,
  },
}

/**
 * 机柜 LED 的位置（机柜局部归一化坐标 0..1，原点左上）。
 *
 * 与 `CABINET.sketch` 的 `slots`/`lampsPerSlot` 对应——`planCabinet` 里灯位
 * 的算法在这里复刻了一遍，这是**有意的重复**：草图里的灯是墨线圆圈（静态
 * 纹理的一部分），发光的是叠在它上面的小平面（每帧变），两者必须对齐但不是
 * 同一个东西。`__tests__/projectsScene.test.ts` 断言两边算出来的位置一致。
 */
export const CABINET_LAMPS: readonly (readonly [number, number])[] = (() => {
  const { slots, lampsPerSlot } = CABINET.sketch as { slots: number; lampsPerSlot: number }
  const out: [number, number][] = []
  const top = 0.06
  const slotH = (1 - top * 2) / slots
  for (let i = 0; i < slots; i += 1) {
    for (let l = 0; l < lampsPerSlot; l += 1) {
      out.push([0.78 + l * 0.045, top + i * slotH + slotH * 0.46])
    }
  }
  return out
})()

/** 刻度盘：左墙，两个 */
export const DIALS: readonly WallPanel[] = [
  {
    id: 'dial-load',
    face: 'left',
    along: -2.2,
    y: 1.15,
    width: 0.82,
    height: 0.82,
    sketch: {
      kind: 'dial',
      id: 'projects-dial-load',
      size: { width: 256, height: 256 },
      ticks: 11,
      value: 0.68,
      label: 'load',
    },
  },
  {
    id: 'dial-uptime',
    face: 'left',
    along: -1.1,
    y: 1.32,
    width: 0.6,
    height: 0.6,
    tilt: 0.05,
    sketch: {
      kind: 'dial',
      id: 'projects-dial-uptime',
      size: { width: 192, height: 192 },
      ticks: 7,
      value: 0.94,
      label: 'up',
    },
  },
]

/** 电缆：从机柜顶沿后墙走到白板上方 */
export const CABLES: readonly WallPanel[] = [
  {
    id: 'cable-back',
    face: 'back',
    along: 1.4,
    y: 2.3,
    // 世界宽高比必须等于纹理宽高比（1024/128 = 8），否则手绘线条被拉扁。
    // 原先写的是"墙宽 − 0.4 × 高 0.9"，比例 11.8，线条会明显变扁。
    width: 5.6,
    height: 0.7,
    // 压在白板顶边上方，与白板分层
    lift: 0.05,
    sketch: {
      kind: 'cable',
      id: 'projects-cable-back',
      size: { width: 1024, height: 128 },
      from: [0.02, 0.22],
      to: [0.98, 0.34],
      sag: 0.4,
      strands: 3,
    },
  },
]

// ─── 桌面小物 ────────────────────────────────────────────────────────────────

/** 台灯：房间的主光源 */
export const LAMP = {
  /**
   * 灯头位置。
   *
   * 必须**在视野里**：它是房间的主光源，看不见灯的话光就是"从空气里来"。
   * 第一版放在 [−2.5, ·, 1.45]，那是相机侧后方 89°，连转到 azimuth 上限
   * （±0.75 rad ≈ ±43°）都看不到。现在放在台面左前方，半径 2.9 落在环带
   * （2.05–3.75）内、在显示器环（3.4）之内侧，投到画面约 x=−0.5。
   */
  position: [-1.95, 0.58, -2.15] as const,
  /** 暖色，与走廊灯一致 */
  color: '#ffcf8a',
  // 环境光压到 0.22 之后，台灯是房间的主光，强度要顶上来
  intensity: 9.5,
  distance: 9.5,
  /** 灯罩半径。0.24 在画面里是个抢戏的大三角，0.15 才像台灯 */
  shadeRadius: 0.15,
  /** 灯杆底座 */
  baseY: -0.49,
} as const

/** 屏幕的冷光。每块显示器一个很弱的点光，凑出「一屋子屏幕」的氛围 */
export const SCREEN_GLOW = {
  color: '#8fc9ff',
  /** 单块的强度。乘上显示器数量后才是总量，所以给得很小 */
  intensity: 0.85,
  distance: 3.4,
  /** 光源放在屏幕前方一点，否则光被自己的板子挡住 */
  forwardOffset: 0.22,
} as const

/**
 * 环境光。压得很低——这是「深夜」。
 *
 * 第一版给了 0.62，加上复用的走廊纸质墙面（本身很亮），实机看是**大白天**，
 * 「深夜实验室」一点没有；连白板（纸白 #e8e6df）都因为和墙面一个亮度而
 * 看不见。所以这里压到 0.22，并给墙面材质一个暖暗的 `tint` 去乘。
 */
export const AMBIENT = {
  color: '#2b2418',
  intensity: 0.22,
} as const

/**
 * 房间外壳材质的颜色乘子。
 *
 * 复用的是走廊纹理（同一栋楼，零新增下载），但走廊是亮的、这间是深夜的。
 * `meshStandardMaterial.color` 会与贴图相乘，所以用它把同一张贴图压暗、
 * 压暖，不必再做一套贴图。
 */
export const SHELL_TINT = {
  wall: '#6f6350',
  floor: '#7a6a52',
  ceiling: '#4e4636',
} as const

/** 胶带标签：贴在工作台边缘 */
export const DESK_TAPES: readonly {
  id: string
  angle: number
  text: string
  sketch: SketchSpec
}[] = [
  {
    id: 'tape-www',
    angle: -0.42,
    text: 'www',
    sketch: {
      kind: 'tape',
      id: 'projects-tape-www',
      size: { width: 256, height: 56 },
      text: 'www',
    },
  },
  {
    id: 'tape-api',
    angle: 0.38,
    text: 'api',
    sketch: {
      kind: 'tape',
      id: 'projects-tape-api',
      size: { width: 256, height: 56 },
      text: 'api',
    },
  },
]

// ─── 派生 ────────────────────────────────────────────────────────────────────

/**
 * 第 i 块显示器（共 n 块）在环上的角度。
 *
 * n=1 时放正中，不是 arc 的起点——单个项目时把它摆到左后方毫无道理。
 */
export function monitorAngle(index: number, count: number): number {
  const [from, to] = MONITOR_RING.arc
  if (count <= 1) return 0
  return from + ((to - from) * index) / (count - 1)
}

/** 显示器的位置与朝向（面朝房间中心） */
export function monitorTransform(index: number, count: number): {
  position: [number, number, number]
  rotationY: number
} {
  const angle = monitorAngle(index, count)
  const { radius, y } = MONITOR_RING
  return {
    // 0° 朝 −Z（后墙）：z 取负
    position: [Math.sin(angle) * radius, y, -Math.cos(angle) * radius],
    /*
      屏幕法线朝房间中心。

      推导：局部 +Z=(0,0,1) 绕 Y 转 θ 后是 (sinθ, 0, cosθ)。位置
      p=(sin a·r, 0, −cos a·r)，指向中心的方向是 −p 归一化 = (−sin a, 0, cos a)。
      要两者平行 → (sinθ, cosθ) = (−sin a, cos a) → **θ = −a**。

      （先写成 `angle + π` 是错的，那会让法线转到 (−sin a, 0, −cos a)，
      即朝房间外；测试的点积断言直接抓出来了。）
    */
    rotationY: -angle,
  }
}

/**
 * 停靠某块显示器时的相机位姿（房间局部坐标）。
 *
 * 从显示器正前方（沿它的法线往房间中心方向）退 `distance`。
 */
export function monitorDockPose(index: number, count: number): {
  position: [number, number, number]
  target: [number, number, number]
} {
  const angle = monitorAngle(index, count)
  const { radius, y } = MONITOR_RING
  const { distance, targetYOffset } = MONITOR_DOCK
  const sx = Math.sin(angle)
  const sz = -Math.cos(angle)
  return {
    // 法线朝内 → 相机在屏幕与中心之间
    position: [sx * (radius - distance), y, sz * (radius - distance)],
    target: [sx * radius, y + targetYOffset, sz * radius],
  }
}

/** 墙面板 → 房间局部的位置与朝向 */
export function wallPanelTransform(
  panel: Pick<WallPanel, 'face' | 'along' | 'y' | 'tilt' | 'lift'>,
): {
  position: [number, number, number]
  rotation: [number, number, number]
} {
  // 离墙 2cm 起，避免与墙面共面（z-fighting 会闪）；重叠的面板用 lift 分层
  const off = 0.02 + ((panel as { lift?: number }).lift ?? 0)
  const tilt = panel.tilt ?? 0
  switch (panel.face) {
    case 'back':
      return {
        position: [panel.along, panel.y, BACK_Z + off],
        rotation: [0, 0, tilt],
      }
    case 'left':
      return {
        position: [-WALL_X + off, panel.y, panel.along],
        rotation: [0, Math.PI / 2, tilt],
      }
    case 'right':
      return {
        position: [WALL_X - off, panel.y, panel.along],
        rotation: [0, -Math.PI / 2, tilt],
      }
  }
}

/** 机柜 LED 的房间局部坐标 */
export function cabinetLampPosition(
  lamp: readonly [number, number],
): [number, number, number] {
  const { position } = wallPanelTransform(CABINET)
  const [u, v] = lamp
  // 机柜在右墙，面朝 −X。局部 u 沿 −Z，v 沿 −Y
  const halfW = CABINET.width / 2
  const halfH = CABINET.height / 2
  return [
    position[0] - 0.03,
    position[1] + halfH - v * CABINET.height,
    position[2] + halfW - u * CABINET.width,
  ]
}
