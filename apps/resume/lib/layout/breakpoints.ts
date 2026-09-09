/**
 * 断点的单一来源（ADR 20260909182319）。
 *
 * `767.98` 而不是 `768`：与 Tailwind 的 `md:`（min-width 768）严格互补、无重叠。
 * 整点上两侧会同时生效——三处 768 的边界语义原本是相反的。
 */

/** 窄屏上界（含） */
export const NARROW_MAX = 767.98

/** `useViewport` 与 `globals.css` 必须用同一个数 */
export const NARROW_QUERY = `(max-width: ${NARROW_MAX}px)`

/** 触摸设备。与「窄」是两个独立维度——iPad 横屏很宽但是触屏 */
export const COARSE_QUERY = '(pointer: coarse)'

/** 支持悬停。**不是** `!COARSE_QUERY`：Surface、接鼠标的 iPad 两者都为真 */
export const HOVER_QUERY = '(hover: hover)'
