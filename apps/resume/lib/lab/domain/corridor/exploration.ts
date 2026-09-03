/**
 * 「用户开始探索走廊了吗」的判定（ADR 20260903211302）。
 *
 * ## 为什么不能挂在输入事件上
 *
 * 原实现是 `window.addEventListener('wheel' | 'touchmove', …, { once: true })`。
 * 于是**键盘用户永远拿不到这个成就**——走廊的键盘前进（↑↓ / PgUp / PgDn / 空格）
 * 走的是 `useCorridorCamera` 的 `keydown` 分支，不产生 wheel 也不产生 touchmove。
 *
 * 而后果不止是"少一个成就"：`corridor_explore` 的教程气泡
 * （`Scroll or swipe to explore`）**只有被解锁才会关掉**（教程气泡不自动消失），
 * 所以键盘用户从进 Lab 起就有一条永远关不掉的白底气泡压在屏幕底部——而它正好
 * 盖住底部的操作提示（两者原先都是 `bottom: 32px; left: 50%`），也就是审计 E10
 * 花力气修好对比度的那一条。
 *
 * ## 判据换成位移
 *
 * 「探索」这件事的本质是**相机沿走廊移动了一段距离**，与用什么设备触发无关。
 * 判据下移到这里之后，滚轮 / 触摸 / 键盘走同一条路径，加新的输入方式也不需要
 * 记得补一次解锁。
 */

/**
 * 判定为「已探索」的最小位移（世界单位）。
 *
 * 走廊每段长 12 个单位、门间距约 12，取 2 是「明显动了一下」而不是「手抖」：
 * 一次滚轮 delta 100 × `scrollSpeed` 0.02 = 2 个单位的目标位移，所以滚一格就够。
 * 键盘一次按键的步长同量级。
 *
 * 不取更小的值（比如 0.1）：`currentZ` 是每帧向 `targetZ` 插值的，阻尼的尾巴会
 * 让它在目标附近持续微动，太小的阈值等于"一进走廊就解锁"。
 */
export const EXPLORE_MIN_DISTANCE = 2

/** 从起点算起的位移是否足以判定为「已探索」 */
export function hasExploredCorridor(startZ: number, currentZ: number): boolean {
  return Math.abs(currentZ - startZ) >= EXPLORE_MIN_DISTANCE
}
