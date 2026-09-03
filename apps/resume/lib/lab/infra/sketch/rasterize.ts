/**
 * `SketchOp[]` → `HTMLCanvasElement`。roughjs 执行层。
 *
 * 这一层刻意薄：所有布局决策在 `domain/sketch/plan.ts`（纯函数、可完整单测），
 * 这里只把图元喂给 roughjs。分开的理由见 `domain/sketch/types.ts` 顶部。
 *
 * roughjs 负责手绘抖动——它是 Excalidraw 的渲染引擎，与 Lab 的铅笔线稿风
 * 同源，比自己搓抖动靠谱（ADR 20260903140619）。
 */
import rough from 'roughjs'

import { HAND_FONT, type SketchOp } from '@/lib/lab/domain/sketch/types'

/**
 * 手写字体是否已就绪。
 *
 * **这是一个真实的时序坑。** `ctx.fillText` 用当前已加载的字体栅格化；
 * `@font-face` 是 `font-display: swap`，字体到位前 canvas 会用兜底字体画，
 * 而画完就是像素了——字体后到也不会重绘。于是便签上的手写字会变成系统衬线体，
 * 且只在首次访问（字体未进缓存）时出现，本地开发几乎复现不到。
 *
 * 所以栅格化前必须等 `document.fonts.load`。返回 Promise 让调用侧决定是
 * 等待还是先画个不含文字的版本。
 */
export async function ensureHandFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    // 尺寸随便给，`load` 只按族名匹配
    await document.fonts.load(`16px ${HAND_FONT}`)
  } catch {
    // 字体没加载成功不该让整块纹理画不出来，兜底字体也是能看的
  }
}

/** 设备像素比：Retina 上不乘会明显发虚，但上限 2 —— 3x 手机上纹理会翻倍 */
function pixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1))
}

export interface RasterizeOptions {
  width: number
  height: number
  /** 透明底（贴在纸板上时要）还是纸色底 */
  background?: string
  /** 覆盖设备像素比，测试用 */
  ratio?: number
}

/**
 * 执行图元序列。
 *
 * @param ops 由 `planSketch` 产出
 */
export function rasterizeOps(
  ops: readonly SketchOp[],
  { width, height, background, ratio = pixelRatio() }: RasterizeOptions,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // 逻辑坐标系与 plan 里的一致，缩放交给 transform
  ctx.scale(ratio, ratio)

  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }

  const rc = rough.canvas(canvas)

  for (const op of ops) {
    if (op.kind === 'text') {
      ctx.save()
      ctx.font = `${op.size}px ${HAND_FONT}`
      ctx.fillStyle = op.color
      ctx.textAlign = op.align
      ctx.textBaseline = 'alphabetic'
      if (op.rotate) {
        ctx.translate(op.x, op.y)
        ctx.rotate(op.rotate)
        ctx.fillText(op.text, 0, 0)
      } else {
        ctx.fillText(op.text, op.x, op.y)
      }
      ctx.restore()
      continue
    }

    const s = op.style
    const rcOpts = {
      stroke: s.stroke,
      strokeWidth: s.strokeWidth,
      roughness: s.roughness,
      bowing: s.bowing,
      seed: s.seed,
      ...(s.fill ? { fill: s.fill, fillStyle: s.fillStyle ?? 'hachure' } : {}),
    }

    switch (op.kind) {
      case 'rect':
        rc.rectangle(op.x, op.y, op.w, op.h, rcOpts)
        break
      case 'line':
        rc.line(op.x1, op.y1, op.x2, op.y2, rcOpts)
        break
      case 'polygon':
        rc.polygon(op.points.map(p => [p[0], p[1]] as [number, number]), rcOpts)
        break
      case 'ellipse':
        rc.ellipse(op.cx, op.cy, op.w, op.h, rcOpts)
        break
      case 'curve':
        rc.curve(op.points.map(p => [p[0], p[1]] as [number, number]), rcOpts)
        break
    }
  }

  return canvas
}
