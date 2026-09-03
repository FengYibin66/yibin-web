/**
 * `SketchSpec` → `SketchOp[]` 的纯函数。
 *
 * 无 canvas、无 DOM、无 roughjs —— 所以它在 vitest 里可以完整断言，而不必
 * 依赖 jsdom 那套残缺的 canvas 实现。`__tests__/sketchPlan.test.ts` 覆盖
 * 每一种 spec 的图元构成、坐标是否落在画布内、以及同 spec 是否得到同种子。
 *
 * 见 `types.ts` 顶部的分层图。
 */
import {
  BOARD_PAPER,
  INK,
  STICKY_PAPER,
  seedFrom,
  specKey,
  type BoardSpec,
  type CabinetSpec,
  type CableSpec,
  type DialSpec,
  type DiagramNode,
  type DiagramSpec,
  type OpStyle,
  type SketchOp,
  type SketchSpec,
  type StickySpec,
  type TapeSpec,
} from './types'

/** 铅笔线：Lab 的默认笔法 */
function pencil(seed: number, overrides: Partial<OpStyle> = {}): OpStyle {
  return {
    stroke: INK,
    strokeWidth: 2,
    roughness: 1.1,
    bowing: 1.4,
    seed,
    ...overrides,
  }
}

// ─── 便签 ─────────────────────────────────────────────────────────────────────

function planSticky(spec: StickySpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const paper = spec.paper ?? STICKY_PAPER
  const pad = Math.round(w * 0.09)
  const fold = Math.round(Math.min(w, h) * 0.18)
  const ops: SketchOp[] = []

  // 纸面：右下折角，所以用多边形而不是矩形
  ops.push({
    kind: 'polygon',
    points: [
      [1, 1],
      [w - 1, 1],
      [w - 1, h - fold],
      [w - fold, h - 1],
      [1, h - 1],
    ],
    style: pencil(seed, { fill: paper, fillStyle: 'solid', strokeWidth: 2.4 }),
  })

  // 折角的两条折线：一条是折痕，一条是折过去那片的边
  ops.push({
    kind: 'line',
    x1: w - fold,
    y1: h - 1,
    x2: w - fold,
    y2: h - fold,
    style: pencil(seed + 1, { strokeWidth: 1.6 }),
  })
  ops.push({
    kind: 'line',
    x1: w - fold,
    y1: h - fold,
    x2: w - 1,
    y2: h - fold,
    style: pencil(seed + 2, { strokeWidth: 1.6 }),
  })

  /*
    标题字号要看长度，不能固定。

    Patrick Hand 的平均字宽约 0.52em，所以 `len × size × 0.52` 就是估算宽度。
    固定 `h * 0.17` 时长标题会画到纸面外去（实机截图里 "WeChat AI Automat…"
    被截断）——canvas 的 fillText 不会报错也不会自动折行，只是画出界。
    这里按可用宽度反解一个上限，取两者较小。
  */
  const CHAR_WIDTH_RATIO = 0.52
  const available = w - pad * 2 - fold * 0.4
  const titleFit = spec.title.length > 0
    ? available / (spec.title.length * CHAR_WIDTH_RATIO)
    : Infinity
  const titleSize = Math.max(8, Math.round(Math.min(h * 0.17, titleFit)))
  let y = pad + titleSize

  ops.push({
    kind: 'text',
    x: pad,
    y,
    text: spec.title,
    size: titleSize,
    color: INK,
    align: 'left',
    rotate: -0.012,
  })

  // 标题下的手写下划线
  y += Math.round(titleSize * 0.28)
  ops.push({
    kind: 'line',
    x1: pad,
    y1: y,
    x2: Math.min(w - pad, pad + spec.title.length * titleSize * 0.52),
    y2: y,
    style: pencil(seed + 3, { strokeWidth: 1.8 }),
  })

  const longestLine = spec.lines.reduce((m, l) => Math.max(m, l.length), 0)
  const bodyFit = longestLine > 0
    ? available / (longestLine * CHAR_WIDTH_RATIO)
    : Infinity
  const bodySize = Math.max(6, Math.round(Math.min(h * 0.115, bodyFit)))
  const lineGap = Math.round(bodySize * 1.5)
  y += Math.round(lineGap * 0.9)
  for (const [i, line] of spec.lines.entries()) {
    ops.push({
      kind: 'text',
      x: pad,
      y: y + i * lineGap,
      text: line,
      size: bodySize,
      color: INK,
      align: 'left',
      // 每行倾斜量不同，否则整块看起来是印刷体
      rotate: i % 2 === 0 ? -0.008 : 0.006,
    })
  }

  if (spec.pinned) {
    ops.push({
      kind: 'ellipse',
      cx: w / 2,
      cy: Math.round(h * 0.075),
      w: Math.round(w * 0.075),
      h: Math.round(w * 0.075),
      style: pencil(seed + 4, { fill: INK, fillStyle: 'solid', strokeWidth: 1.6 }),
    })
  }

  return ops
}

// ─── 白板 ─────────────────────────────────────────────────────────────────────

function planBoard(spec: BoardSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const ops: SketchOp[] = []

  ops.push({
    kind: 'rect',
    x: 3,
    y: 3,
    w: w - 6,
    h: h - 6,
    style: pencil(seed, { fill: BOARD_PAPER, fillStyle: 'solid', strokeWidth: 3.2 }),
  })

  // 网格：淡笔，纯装饰。间距 0 表示不画
  const grid = spec.grid ?? 0
  if (grid > 0) {
    const faint = { stroke: '#c9c6bb', strokeWidth: 1, roughness: 0.6, bowing: 0.5 }
    // 两轴的种子偏移必须错开：方形画布上 x 与 y 取值相同，都写
    // `seed + 坐标` 会让"竖线 @64"和"横线 @64"共用种子——roughjs 于是给
    // 它们一模一样的抖动，成对出现，看起来就是印刷的网格纸而不是手画的
    for (let x = grid; x < w - grid / 2; x += grid) {
      ops.push({ kind: 'line', x1: x, y1: 8, x2: x, y2: h - 8, style: { ...faint, seed: seed + x * 2 + 1 } })
    }
    for (let y = grid; y < h - grid / 2; y += grid) {
      ops.push({ kind: 'line', x1: 8, y1: y, x2: w - 8, y2: y, style: { ...faint, seed: seed + y * 2 + 2 } })
    }
  }

  if (spec.title) {
    const size = Math.round(h * 0.075)
    ops.push({
      kind: 'text',
      x: Math.round(w * 0.5),
      y: Math.round(h * 0.11),
      text: spec.title,
      size,
      color: INK,
      align: 'center',
      rotate: -0.006,
    })
  }

  // 底部笔槽：让它看起来是一块真白板而不是一张纸
  const tray = Math.round(h * 0.055)
  ops.push({
    kind: 'rect',
    x: Math.round(w * 0.08),
    y: h - tray - 6,
    w: Math.round(w * 0.84),
    h: tray,
    style: pencil(seed + 7, { strokeWidth: 2.2 }),
  })

  return ops
}

// ─── 机柜 ─────────────────────────────────────────────────────────────────────

function planCabinet(spec: CabinetSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const ops: SketchOp[] = []

  ops.push({
    kind: 'rect',
    x: 4,
    y: 4,
    w: w - 8,
    h: h - 8,
    style: pencil(seed, { fill: '#d8cfbc', fillStyle: 'solid', strokeWidth: 3 }),
  })

  const top = Math.round(h * 0.06)
  const usable = h - top * 2
  const slotH = usable / spec.slots
  const lamps = spec.lampsPerSlot ?? 3

  for (let i = 0; i < spec.slots; i += 1) {
    const y = top + i * slotH
    ops.push({
      kind: 'rect',
      x: Math.round(w * 0.09),
      y: Math.round(y + slotH * 0.12),
      w: Math.round(w * 0.82),
      h: Math.round(slotH * 0.72),
      style: pencil(seed + i * 13 + 1, { strokeWidth: 1.8 }),
    })
    // 散热格栅：只在偶数槽画，全画会糊成一片
    if (i % 2 === 0) {
      for (let g = 0; g < 4; g += 1) {
        const gx = Math.round(w * 0.14 + g * w * 0.055)
        ops.push({
          kind: 'line',
          x1: gx,
          y1: Math.round(y + slotH * 0.24),
          x2: gx,
          y2: Math.round(y + slotH * 0.6),
          style: {
            stroke: INK,
            strokeWidth: 1.2,
            roughness: 0.9,
            bowing: 0.8,
            seed: seed + i * 13 + g + 2,
          },
        })
      }
    }
    for (let l = 0; l < lamps; l += 1) {
      ops.push({
        kind: 'ellipse',
        cx: Math.round(w * 0.78 + l * w * 0.045),
        cy: Math.round(y + slotH * 0.46),
        w: Math.round(w * 0.026),
        h: Math.round(w * 0.026),
        style: pencil(seed + i * 13 + l + 5, { strokeWidth: 1.2 }),
      })
    }
  }

  return ops
}

// ─── 刻度盘 ───────────────────────────────────────────────────────────────────

function planDial(spec: DialSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - 6
  const ops: SketchOp[] = []

  ops.push({
    kind: 'ellipse',
    cx,
    cy,
    w: r * 2,
    h: r * 2,
    style: pencil(seed, { fill: '#efe6cf', fillStyle: 'solid', strokeWidth: 3 }),
  })

  // 刻度只画上半圈（-140° .. +140°），仪表盘的常规样子
  const span = (280 * Math.PI) / 180
  const start = -Math.PI / 2 - span / 2
  for (let i = 0; i < spec.ticks; i += 1) {
    const a = start + (span * i) / Math.max(1, spec.ticks - 1)
    const long = i === 0 || i === spec.ticks - 1 || i % 3 === 0
    const inner = r * (long ? 0.7 : 0.8)
    ops.push({
      kind: 'line',
      x1: cx + Math.cos(a) * inner,
      y1: cy + Math.sin(a) * inner,
      x2: cx + Math.cos(a) * r * 0.92,
      y2: cy + Math.sin(a) * r * 0.92,
      style: pencil(seed + i + 1, { strokeWidth: long ? 2 : 1.2 }),
    })
  }

  const a = start + span * Math.min(1, Math.max(0, spec.value))
  ops.push({
    kind: 'line',
    x1: cx,
    y1: cy,
    x2: cx + Math.cos(a) * r * 0.66,
    y2: cy + Math.sin(a) * r * 0.66,
    style: pencil(seed + 99, { strokeWidth: 3 }),
  })
  ops.push({
    kind: 'ellipse',
    cx,
    cy,
    w: r * 0.13,
    h: r * 0.13,
    style: pencil(seed + 98, { fill: INK, fillStyle: 'solid', strokeWidth: 1.4 }),
  })

  if (spec.label) {
    ops.push({
      kind: 'text',
      x: cx,
      y: cy + r * 0.55,
      text: spec.label,
      size: Math.round(r * 0.2),
      color: INK,
      align: 'center',
    })
  }

  return ops
}

// ─── 胶带标签 ─────────────────────────────────────────────────────────────────

function planTape(spec: TapeSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  // 胶带两端是撕开的锯齿，所以用多边形
  const jag = Math.round(w * 0.022)
  const left: (readonly [number, number])[] = []
  const right: (readonly [number, number])[] = []
  const steps = 5
  for (let i = 0; i <= steps; i += 1) {
    const y = 2 + ((h - 4) * i) / steps
    left.push([2 + (i % 2 === 0 ? 0 : jag), y])
    right.push([w - 2 - (i % 2 === 0 ? jag : 0), y])
  }
  return [
    {
      kind: 'polygon',
      points: [...left, ...right.reverse()],
      style: pencil(seed, {
        fill: spec.paper ?? '#e6dcc0',
        fillStyle: 'solid',
        strokeWidth: 1.6,
        roughness: 1.4,
      }),
    },
    {
      kind: 'text',
      x: w / 2,
      y: Math.round(h * 0.68),
      text: spec.text,
      size: Math.round(h * 0.52),
      color: INK,
      align: 'center',
      rotate: -0.01,
    },
  ]
}

// ─── 电缆 ─────────────────────────────────────────────────────────────────────

function planCable(spec: CableSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const sag = (spec.sag ?? 0.12) * h
  const strands = spec.strands ?? 1
  const [fx, fy] = spec.from
  const [tx, ty] = spec.to
  const ops: SketchOp[] = []

  for (let s = 0; s < strands; s += 1) {
    const offset = (s - (strands - 1) / 2) * Math.max(3, h * 0.02)
    const pts: (readonly [number, number])[] = []
    const steps = 8
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const x = (fx + (tx - fx) * t) * w
      const base = (fy + (ty - fy) * t) * h
      // 垂链近似：4·sag·t·(1−t) 在中点取到 sag
      const y = base + 4 * sag * t * (1 - t) + offset
      pts.push([x, y])
    }
    ops.push({
      kind: 'curve',
      points: pts,
      style: pencil(seed + s, { strokeWidth: 2.4, roughness: 0.8, bowing: 0.6 }),
    })
  }

  return ops
}

// ─── 架构图 ───────────────────────────────────────────────────────────────────

/** 箭头两翼的长度，占画布短边的比例 */
const ARROW_HEAD = 0.018

function planDiagram(spec: DiagramSpec): SketchOp[] {
  const { width: w, height: h } = spec.size
  const seed = seedFrom(specKey(spec))
  const ops: SketchOp[] = []
  const byId = new Map(spec.nodes.map(n => [n.id, n]))

  if (spec.title) {
    const size = Math.round(h * 0.085)
    ops.push({
      kind: 'text',
      x: Math.round(w * 0.5),
      y: Math.round(h * 0.09),
      text: spec.title,
      size,
      color: INK,
      align: 'center',
      rotate: -0.005,
    })
  }

  // 先画连线，方框压在上面 —— 否则线头会盖住框线，看起来是穿过去的
  for (const [i, edge] of spec.edges.entries()) {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    // 指向不存在的节点：跳过而不是画到 NaN 去（roughjs 遇 NaN 静默什么都不画）
    if (!a || !b) continue

    const [x1, y1, x2, y2] = edgeEndpoints(a, b, w, h)
    ops.push({
      kind: 'line',
      x1, y1, x2, y2,
      style: pencil(seed + i * 7 + 200, { strokeWidth: 1.6, roughness: 0.9 }),
    })

    const head = Math.min(w, h) * ARROW_HEAD
    ops.push(...arrowHead(x2, y2, x1, y1, head, seed + i * 7 + 210))
    if (edge.both) ops.push(...arrowHead(x1, y1, x2, y2, head, seed + i * 7 + 220))

    if (edge.label) {
      ops.push({
        kind: 'text',
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2 - Math.round(h * 0.012),
        text: edge.label,
        size: Math.round(h * 0.042),
        color: '#5b4d33',
        align: 'center',
      })
    }
  }

  for (const [i, node] of spec.nodes.entries()) {
    const nx = node.x * w
    const ny = node.y * h
    const nw = node.w * w
    const nh = node.h * h
    ops.push({
      kind: 'rect',
      x: nx - nw / 2,
      y: ny - nh / 2,
      w: nw,
      h: nh,
      style: pencil(seed + i * 11 + 1, {
        strokeWidth: node.dashed ? 1.4 : 2.2,
        // 虚线用潦草笔法近似——roughjs 没有 dash，但高 roughness 的
        // 手绘线本身就断续，视觉上足够区分"外部的东西"
        roughness: node.dashed ? 2.4 : 1.0,
        fill: '#f6f4ec',
        fillStyle: 'solid',
      }),
    })
    const labelSize = Math.round(nh * (node.sub ? 0.3 : 0.36))
    ops.push({
      kind: 'text',
      x: nx,
      y: ny + (node.sub ? -nh * 0.04 : labelSize * 0.35),
      text: node.label,
      size: labelSize,
      color: INK,
      align: 'center',
      rotate: i % 2 === 0 ? -0.006 : 0.005,
    })
    if (node.sub) {
      ops.push({
        kind: 'text',
        x: nx,
        y: ny + nh * 0.28,
        text: node.sub,
        size: Math.round(nh * 0.21),
        color: '#5b4d33',
        align: 'center',
      })
    }
  }

  return ops
}

/**
 * 连线的端点：从各自方框的边界出发，而不是中心。
 *
 * 从中心画会让线头埋在方框里（方框是实心填充的），看起来像断线。
 */
function edgeEndpoints(
  a: DiagramNode,
  b: DiagramNode,
  w: number,
  h: number,
): [number, number, number, number] {
  const ax = a.x * w
  const ay = a.y * h
  const bx = b.x * w
  const by = b.y * h
  return [
    ...boxExit(ax, ay, a.w * w, a.h * h, bx, by),
    ...boxExit(bx, by, b.w * w, b.h * h, ax, ay),
  ] as [number, number, number, number]
}

/** 从 (cx,cy) 尺寸 (w,h) 的框朝 (tx,ty) 方向的出口点 */
function boxExit(
  cx: number, cy: number, w: number, h: number, tx: number, ty: number,
): [number, number] {
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  // 以框的半宽/半高为尺度，取先撞到的那条边
  const scale = Math.min(
    dx === 0 ? Infinity : (w / 2) / Math.abs(dx),
    dy === 0 ? Infinity : (h / 2) / Math.abs(dy),
  )
  return [cx + dx * scale, cy + dy * scale]
}

/** 箭头两翼。指向 (x,y)，来自 (fromX, fromY) */
function arrowHead(
  x: number, y: number, fromX: number, fromY: number, size: number, seed: number,
): SketchOp[] {
  const angle = Math.atan2(y - fromY, x - fromX)
  const spread = 0.42
  return [-1, 1].map((sign, i) => ({
    kind: 'line' as const,
    x1: x,
    y1: y,
    x2: x - Math.cos(angle + sign * spread) * size,
    y2: y - Math.sin(angle + sign * spread) * size,
    style: pencil(seed + i, { strokeWidth: 1.6, roughness: 0.7 }),
  }))
}

// ─── 派发 ─────────────────────────────────────────────────────────────────────

export function planSketch(spec: SketchSpec): SketchOp[] {
  switch (spec.kind) {
    case 'sticky': return planSticky(spec)
    case 'diagram': return planDiagram(spec)
    case 'board': return planBoard(spec)
    case 'cabinet': return planCabinet(spec)
    case 'dial': return planDial(spec)
    case 'tape': return planTape(spec)
    case 'cable': return planCable(spec)
  }
}
