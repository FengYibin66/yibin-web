/**
 * 走廊活物的行为规则（ADR 20260908160918，规格 `docs/specs/lab-companions.md` §2）。
 *
 * 判据是纯逻辑，所以在纯函数里测：写在 `useFrame` 里时「靠近会醒吗」只能靠 E2E
 * 走 80 个世界单位，而软渲染下导轨的指数插值收敛极慢，CI 上直接超时。
 */

export type CatState = 'sleep' | 'awake' | 'stretch'

/** 相机进入这个距离 → 醒 */
export const CAT_WAKE_DISTANCE = 8
/** 相机离开这个距离 → 睡。与醒的阈值不同是刻意的：单阈值会在临界点反复睁闭眼 */
export const CAT_SLEEP_DISTANCE = 12

/**
 * 按与相机的距离决定猫的下一个状态。
 *
 * `stretch` 不受距离影响——它是被点出来的，动画结束时切回 `awake`。
 * 距离非有限值时保持原状态：那说明导轨还没初始化，任何切换都是猜的。
 */
export function nextCatState(current: CatState, distance: number): CatState {
  if (current === 'stretch') return current
  if (!Number.isFinite(distance)) return current
  const d = Math.abs(distance)
  if (current === 'sleep') return d <= CAT_WAKE_DISTANCE ? 'awake' : 'sleep'
  return d > CAT_SLEEP_DISTANCE ? 'sleep' : 'awake'
}
