/**
 * Lab 的动效开关——`prefers-reduced-motion` 的唯一入口（ADR 20260908172231）。
 *
 * 值是 `0 | 1` 而不是布尔：消费者写 `Math.sin(t) * amplitude * motionScale`，
 * 乘一个数比到处写 `if (reduced) return` 少一类「忘了处理 reduced 分支」的 bug。
 * 不留中间值——「半速动画」是另一个产品决定，且对晕动没有帮助。
 *
 * 这个模块**不决定**哪些动效该停，只回答「系统要求减少动效吗」。
 * 门禁 `__tests__/motionConsumers.test.ts` 守「每个持续动画的 `useFrame` 都读过它」。
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function mediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    return window.matchMedia(QUERY)
  } catch {
    // 某些嵌入式 WebView 的 matchMedia 对未知媒体特性抛错
    return null
  }
}

/** 系统是否要求减少动效。SSR / 不支持 matchMedia 时返回 false（正常动效） */
export function prefersReducedMotion(): boolean {
  return mediaQueryList()?.matches === true
}

/** 当前动效倍率：0 = 停掉持续动画，1 = 正常 */
export function currentMotionScale(): 0 | 1 {
  return prefersReducedMotion() ? 0 : 1
}

/**
 * 订阅系统设置的变化，立即回调一次当前值。返回注销函数。
 *
 * 用 `addEventListener` 并回退到 `addListener`：后者已废弃，但 Safari 14
 * 之前只有它 —— 而 iOS 上的旧 Safari 正是最需要这个设置的那批设备。
 */
export function subscribeMotionScale(onChange: (scale: 0 | 1) => void): () => void {
  const mql = mediaQueryList()
  onChange(mql?.matches ? 0 : 1)
  if (!mql) return () => {}

  const handler = (event: MediaQueryListEvent) => onChange(event.matches ? 0 : 1)

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }

  /*
    废弃但仍必要的回退：Safari 14 之前的 `MediaQueryList` 只有 `addListener`
    ——而 iOS 上的旧 Safari 正是最需要这个设置的那批设备。
  */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (typeof mql.addListener === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mql.addListener(handler)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return () => mql.removeListener(handler)
  }

  /*
    两个 API 都没有。**这不是假想情况**：jsdom 的 `matchMedia` 桩就是这样，
    于是"没有 addEventListener 就一定有 addListener"这个假设让三个既有的
    `LabScene` 组件测试直接抛错（`mql.addListener is not a function`）。
    同类的桩在嵌入式 WebView 与部分测试环境里都存在。

    此时当前值已经回调过了（函数开头），只是订阅不到后续变化——对一个
    "系统设置"来说这是可接受的退化。
  */
  return () => {}
}
