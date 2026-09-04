/**
 * 开发态断言在生产构建里也能按需打开。
 *
 * ## 为什么需要这个开关
 *
 * `CameraRig` 的相机所有权断言原先只看 `process.env.NODE_ENV !== 'production'`。
 * 而本应用是静态导出，E2E 打的是 `out/`——**永远是 production**。于是那条断言
 * 在 122 个 E2E 用例里一次都没执行过，首帧假阳性（`take()` 没记基线，每帧抛）
 * 一直到第一次有人在 `next dev` 里进 Projects 房间才炸出来（2026-09-04）。
 *
 * "断言只在开发态跑" 的隐含前提是"有人会在开发态把路径都走一遍"。这里没有
 * 这个前提：验收流程是单测 + 生产构建 E2E。所以让 E2E 自己把断言打开。
 *
 * ## 怎么开
 *
 * `localStorage.lab_asserts = '1'`。E2E 的 `openLab()` 在 `addInitScript` 里设，
 * 配合每条用例结束时 `pageerror` 必须为空的夹具，断言一抛 E2E 就红。
 *
 * 值在首次调用时读一次并缓存：断言在 `useFrame` 里每帧查，不能每帧碰 storage。
 */
let cached: boolean | null = null

export function labAssertsEnabled(): boolean {
  if (cached !== null) return cached
  if (process.env.NODE_ENV !== 'production') {
    cached = true
    return cached
  }
  try {
    cached = typeof window !== 'undefined' && window.localStorage.getItem('lab_asserts') === '1'
  } catch {
    cached = false
  }
  return cached
}

/** 测试用：清掉缓存 */
export function resetLabAssertsCache(): void {
  cached = null
}
