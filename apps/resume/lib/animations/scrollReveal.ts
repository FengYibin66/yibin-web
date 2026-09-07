import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { REVEAL_END, REVEALS } from './revealSpecs'

export { REVEALS } from './revealSpecs'
export type { RevealSpec } from './revealSpecs'

/**
 * Classic 页的滚动显形（运行时）。声明在 `./revealSpecs.ts`。
 *
 * ## 这次改动的由来（2026-09-07）
 *
 * 前身 `scrollAnimations.ts` 用 `gsap.from` + `ScrollTrigger`，由 `ClassicPage` 在
 * effect 里注册、cleanup 里 `ScrollTrigger.getAll().forEach(t => t.kill())`。
 * 从详情页点「返回简历」（客户端导航，hash 已就位）再往上滚，卡片停在 3%–83%
 * 透明度。三件事缺一不发生：
 *
 *   1. `getAll()` 不分归属；`kill()` 默认连带杀 tween。
 *   2. StrictMode 双跑 effect：第一次注册的 tween 已开播就被杀在半路。
 *   3. `gsap.from` 是「从给定值动画**到当前值**」——第二次注册把残值当了终点。
 *
 * 线上没有 StrictMode，所以看不到；但结构上它随时可能因别的原因（HMR、二次挂载）
 * 复发。修法是三条不变量，而不是绕开某一条：
 *
 *   - **归属**：一切创建物在 `gsap.context()` 里，cleanup 只 `revert()` 自己的
 *     （ADR 20260907120701；全仓禁止 `getAll()`，门禁 `noGlobalScrollTriggerKill`）。
 *   - **终点显式**：`fromTo` 而不是 `from`，终点是常量 `REVEAL_END`，不读 DOM 当前值。
 *     完成后 `clearProps` 清掉内联样式，DOM 回到无痕。
 *   - **已滚过的直接呈现**：带 hash 进入时视口上方的内容不补播入场动画。
 */

export interface ScrollRevealHandle {
  /** 撤销本次挂载创建的一切：tween、触发器、内联样式。幂等 */
  revert(): void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 挂载显形。返回的句柄 `revert()` 之后 DOM 无痕；重复挂载安全。
 *
 * 调用时机：等 hash 滚动就位之后（`ClassicPage` 在 rAF 里调）。挂载后立刻 `refresh()`
 * ——已在 end 之后的触发器会在这一步 onEnter，回调里把 tween 快进到终点。
 */
export function mountScrollReveal(): ScrollRevealHandle {
  gsap.registerPlugin(ScrollTrigger)

  if (prefersReducedMotion()) {
    // 不注册就是最好的动画：内容保持原样，没有内联样式、没有触发器
    return { revert() {} }
  }

  /*
    到达方式决定已在视口内 / 上方的内容怎么出现：
    - 从顶部进（scrollY 0）：首屏内容播入场动画，这是页面的开场。
    - 中途到达（hash 直达、详情页返回、滚动恢复）：用户是"跳"过来的，已过起点的
      内容一律直接呈现——补播 0.6–1.7 秒只会让人一往上滚就撞见半透明的中间态。
    判据在挂载那一刻取一次（挂载在 rAF 里，hash 滚动已就位）；`settling` 只在
    紧随其后的那次 refresh 里为真，之后用户自己滚出来的触发照常播。
  */
  const arrivedMidPage = typeof window !== 'undefined' && window.scrollY > 0
  let settling = true

  const ctx = gsap.context(() => {
    for (const spec of REVEALS) {
      if (document.querySelectorAll(spec.targets).length === 0) continue
      const to: Record<string, number> = {}
      for (const key of Object.keys(spec.from)) {
        if (key in REVEAL_END) to[key] = REVEAL_END[key]!
      }
      gsap.fromTo(spec.targets, { ...spec.from }, {
        ...to,
        duration: spec.duration,
        stagger: spec.stagger,
        ease: spec.ease,
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: spec.trigger,
          start: spec.start,
          once: true,
          /*
            进入时已经在 end 之后（progress 1）= 用户是带 hash / 滚动恢复跳过来的，
            这一区在视口上方、没人在看。补播 0.6–1.7 秒入场动画只会让人一往上滚
            就撞见半透明的中间态；快进等于「你来晚了，东西本来就在」。

            必须在 onEnter 里做：`once: true` 的触发器在这次 update 结束就自杀，
            事后再读 `progress` / `animation` 已经拿不到。
          */
          onEnter(self) {
            if (self.progress >= 1 || (settling && arrivedMidPage)) self.animation?.progress(1)
          },
        },
      })
    }
  })

  ScrollTrigger.refresh()
  settling = false

  /*
    ScrollTrigger 的 start / end 是挂载时算成像素的，内容变高变矮它不知道。
    切语言（中文文案更短）、图片 / 字体加载完成，都会让后面区的触发点漂移——
    E2E 在 mobile-safari 上抓到：切到中文后页面变短，联系区的触发点被推到最大滚动
    之外，永远到不了。body 尺寸一变就 refresh（合并到下一帧，避免连续布局抖动
    时每次都重算）。
  */
  let refreshRaf = 0
  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
      cancelAnimationFrame(refreshRaf)
      refreshRaf = requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    : null
  observer?.observe(document.body)

  let reverted = false
  return {
    revert() {
      if (reverted) return
      reverted = true
      observer?.disconnect()
      cancelAnimationFrame(refreshRaf)
      ctx.revert()
    },
  }
}
