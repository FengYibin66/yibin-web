/**
 * WCAG 对比度计算。
 *
 * 存在的理由是审计 E10：Lab 的两处覆盖层文案（"退出 Lab" 用金色 0.6 alpha、
 * "SCROLL TO EXPLORE" 用墨色 0.4 alpha）在白墙白地上几乎看不见。算下来
 * 对比度分别是 1.9 与 2.4——远低于正文要求的 4.5。
 *
 * 「几乎看不见」是个主观描述，改的时候很容易调成"我这块屏上够了"。有了这个
 * 函数，`__tests__/labContrast.test.ts` 就能把它变成一条会红的断言。
 *
 * 公式来自 WCAG 2.1：相对亮度用 sRGB 的线性化分量加权，对比度是
 * `(L_lighter + 0.05) / (L_darker + 0.05)`。
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** `#rgb` / `#rrggbb` / `rgba(r,g,b,a)` / `rgb(r,g,b)` */
export function parseColor(color: string): { rgb: Rgb; alpha: number } | null {
  const text = color.trim()

  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const raw = hex[1]!
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
    return {
      rgb: {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      },
      alpha: 1,
    }
  }

  const fn = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i)
  if (fn) {
    return {
      rgb: { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) },
      alpha: fn[4] === undefined ? 1 : Number(fn[4]),
    }
  }

  return null
}

/**
 * 半透明前景压到不透明背景上的实际颜色。
 *
 * 必须做这一步：`rgba(42,31,14,0.4)` 本身不能直接算亮度——它的观感完全取决于
 * 背后是什么。E10 的两处正是"颜色本身很深，但 alpha 太低"。
 */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b) }
}

function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** 相对亮度（WCAG 2.1） */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * 对比度。前景可以带 alpha，会先压到背景上。
 *
 * @returns 1（完全看不见）到 21（黑白）
 */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return Number.NaN

  const effective = fg.alpha >= 1 ? fg.rgb : composite(fg.rgb, fg.alpha, bg.rgb)
  const l1 = relativeLuminance(effective)
  const l2 = relativeLuminance(bg.rgb)
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG AA 的门槛 */
export const WCAG_AA = {
  /** 正文 */
  normalText: 4.5,
  /** 大字（>= 18.66px 加粗，或 >= 24px） */
  largeText: 3,
  /** 图形与界面组件（边框、图标） */
  uiComponent: 3,
} as const
