/**
 * 「用户开始探索走廊了吗」的判定（ADR 20260903211302）。
 *
 * 判据是**位移**，不是输入事件。挂在 `wheel` / `touchmove` 上时键盘用户
 * （↑↓ / PgUp / PgDn / 空格走 `useCorridorCamera` 的 keydown 分支）永远解不开，
 * 而 `corridor_explore` 的教程气泡只有解锁才会关——于是屏幕底部会常驻一条
 * 关不掉的白底气泡。
 */

/**
 * 判定为「已探索」的最小位移（世界单位）。
 *
 * 走廊每段 12 个单位；一次滚轮 delta 100 × `scrollSpeed` 0.02 = 2，所以滚一格就够。
 * 不能更小：`currentZ` 每帧向 `targetZ` 插值，阻尼尾巴会在目标附近持续微动。
 */
export const EXPLORE_MIN_DISTANCE = 2

/** 从起点算起的位移是否足以判定为「已探索」 */
export function hasExploredCorridor(startZ: number, currentZ: number): boolean {
  return Math.abs(currentZ - startZ) >= EXPLORE_MIN_DISTANCE
}
