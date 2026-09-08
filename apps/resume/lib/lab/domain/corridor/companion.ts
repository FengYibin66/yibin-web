/**
 * 走廊活物的行为规则（ADR 20260908160918）。
 *
 * 目前只有猫的三态。狗的 reducer 等线稿素材到位后加在这里
 * （规格：`docs/specs/lab-companions.md` §2）。
 *
 * ## 为什么这几行值得放进 domain
 *
 * 它们原先写在 `ResidentCat` 的 `useFrame` 里，于是"靠近会醒吗"只能靠 E2E 走
 * 80 个世界单位去验 —— 而 Lab 的 E2E 跑在 SwiftShader 软渲染上，导轨的指数插值
 * （lerp 0.035/帧）在那个帧率下收敛得极慢，CI 上直接超时（实测两个 project 都红）。
 *
 * 判据是纯逻辑，就该在纯函数里测：滞回、边界、坏输入各一条断言，一毫秒跑完。
 * E2E 只留"初始是睡着的"这种快而确定的部分，端到端由巡检脚本覆盖。
 */

export type CatState = 'sleep' | 'awake' | 'stretch'

/** 相机进入这个距离 → 醒 */
export const CAT_WAKE_DISTANCE = 8
/**
 * 相机离开这个距离 → 睡。
 *
 * 与 `CAT_WAKE_DISTANCE` 不同是刻意的：单阈值会让人站在临界点上时猫反复睁眼闭眼。
 */
export const CAT_SLEEP_DISTANCE = 12

/**
 * 按与相机的距离决定猫的下一个状态。
 *
 * `stretch`（伸懒腰）不受距离影响 —— 它是被点出来的，由动画结束时切回 `awake`。
 * 距离是非有限值时保持原状态：那说明导轨还没初始化，此时任何切换都是猜的。
 */
export function nextCatState(current: CatState, distance: number): CatState {
  if (current === 'stretch') return current
  if (!Number.isFinite(distance)) return current
  const d = Math.abs(distance)
  if (current === 'sleep') return d <= CAT_WAKE_DISTANCE ? 'awake' : 'sleep'
  return d > CAT_SLEEP_DISTANCE ? 'sleep' : 'awake'
}
