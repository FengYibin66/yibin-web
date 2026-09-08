/**
 * Lab 的动效开关 —— `prefers-reduced-motion` 的唯一入口（ADR 20260908172231）。
 *
 * ## Lab 此前完全不响应这个设置
 *
 * 全仓 `prefers-reduced-motion` 只有 5 处命中，**全部与 Lab 无关**（Classic 的
 * 滚动显形、入口页 CSS、画廊加载、加载指示器的 CSS 动画）。而 Lab 是全站动效
 * 最密的地方：走廊自动侧瞄、涂鸦漂浮、头像逐帧、虫子游走、桶浮动、卡片转盘
 * 全都无条件在动。对前庭功能敏感的访客，这一页是"进去就晃"。
 *
 * 走廊要加的活物（ADR 20260908160918）会让这个缺口更明显 —— 一只持续跑动的
 * 狗是屏幕上唯一始终在动的东西。所以开关先行。
 *
 * ## 为什么是 0/1 而不是布尔
 *
 * 消费者的用法是 `Math.sin(t) * amplitude * motionScale` —— 乘一个数比到处
 * 写 `if (reduced) return` 少一个分支，也少一类"忘了处理 reduced 分支"的 bug。
 * 类型是 `0 | 1` 而不是 `number`：中间值意味着"半速动画"，那是另一个产品决定
 * （而且对晕动没有帮助），不留这个口子。
 *
 * ## 不做什么
 *
 * 这个模块**不决定**哪些动效该停。它只回答"系统要求减少动效吗"。谁停、停到
 * 什么程度由各消费者按自己的语义决定（活物改为坐着、涂鸦不漂浮、虫子不游走
 * 但仍可点）—— 门禁 `__tests__/motionConsumers.test.ts` 守"每个持续动画的
 * `useFrame` 都读过 `motionScale`"。
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
