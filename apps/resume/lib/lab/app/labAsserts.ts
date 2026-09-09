/**
 * 让开发态断言在生产构建里也能按需打开：`localStorage.lab_asserts = '1'`。
 *
 * 静态导出的 E2E 打的是 `out/`，**永远是 production**——只看 `NODE_ENV` 的断言
 * 在 122 个用例里一次都没执行过，首帧假阳性因此漏到了实机。
 * 「断言只在开发态跑」的隐含前提是有人会在开发态把路径都走一遍，这里没有这个前提。
 *
 * 值首次调用时读一次并缓存：断言在 `useFrame` 里每帧查，不能每帧碰 storage。
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
