/**
 * 断点的单一来源（ADR 20260909182319）。
 *
 * ## 为什么是 767.98 而不是 768
 *
 * `768` 这个数字此前有三个独立表示，且**边界语义相反**：
 *
 *   Tailwind `md:`（47 处 / 15 文件）        ≥ 768 生效
 *   `globals.css` 的两条 `@media`（max-width）  ≤ 768 生效
 *   `app/page.tsx` 的 `isStacked`（matchMedia）  ≤ 768 生效
 *
 * 于是**在正好 768px 上「手机 CSS」与「桌面 Tailwind」同时生效**——一条真实的
 * off-by-one。而 E2E 的 mobile-safari 形态是 iPhone 13（390px），结构上永远
 * 测不到这一点。
 *
 * `767.98` 是这类问题的常规解法：它小于 768 的任何设备像素取值，所以
 * `max-width: 767.98px` 与 Tailwind 的 `min-width: 768px` 严格互补、无重叠、无空隙。
 * 用 `.98` 而非 `.99` 或 `.999` 只是行业惯例（Bootstrap 用 `.98`），无技术差别。
 */

/** 窄屏上界（含）。与 Tailwind 的 `md:`（≥768）严格互补 */
export const NARROW_MAX = 767.98

/** 窄屏媒体查询串。`useViewport` 与 `globals.css` 用的必须是同一个数 */
export const NARROW_QUERY = `(max-width: ${NARROW_MAX}px)`

/** 触摸设备（无精确指针）。与「窄」是两个独立维度——iPad 横屏很宽但是触屏 */
export const COARSE_QUERY = '(pointer: coarse)'

/**
 * 支持悬停。**不要**用 `!COARSE_QUERY` 代替它：
 * 有些设备同时有触摸与鼠标（Surface、接了鼠标的 iPad），两个查询都为真。
 */
export const HOVER_QUERY = '(hover: hover)'
