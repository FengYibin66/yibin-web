import { render } from '@testing-library/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { REVEALS, mountScrollReveal } from '@/lib/animations/scrollReveal'

/**
 * Classic 页的滚动显形（2026-09-07 实机 bug）。
 *
 * 现象：从论文详情点「返回简历」落到 `/classic/#publications`，再往上滚，项目卡 /
 * 时间轴 / 技能徽章停在 3%–83% 透明度。复现：dev 必现，线上不出现。
 *
 * 根因是三件事叠加，缺一不发生：
 *   1. `ClassicPage` 的 cleanup 是 `ScrollTrigger.getAll().forEach(t => t.kill())`，
 *      而 `ScrollTrigger.kill()` **连带杀掉关联的 tween**，且 `getAll()` 不分归属；
 *   2. dev 的 StrictMode 把 effect 跑两遍：客户端导航进来时 hash 已就位、触发器一
 *      注册就开播，cleanup 把播放中的 tween 杀在半路（opacity 0.03–0.8）；
 *   3. 第二次注册用的是 `gsap.from`——「从给定值动画**到元素当前值**」——把残值
 *      当成了终点。
 *
 * 顺带查出：三条声明的选择器（`#about .edu-card` / `#contact .contact-item`）在页面上
 * **匹配不到任何元素**，教育卡翻转、联系区渐入从来没跑过；线上每次进 Classic 有
 * 3 条 gsap 空目标警告，正是它们。
 *
 * 这里守的是修法的四条不变量，而不是某个像素：
 *   - 每条声明的选择器真能匹配到元素（死选择器直接红）
 *   - 挂载 → 撤销 → 再挂载（StrictMode 的形态）之后没有残值
 *   - `revert()` 不留内联样式
 *   - 不碰别人的 ScrollTrigger
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/classic/',
}))

/*
  jsdom 没有 `matchMedia`。显形按 `prefers-reduced-motion` 分支，这里给一个可切换的
  stub；默认「无偏好」= 正常注册。
*/
let reducedMotion = false
function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? reducedMotion : !reducedMotion,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

async function renderClassicSections() {
  const mod = await import('@/components/sections')
  const { CredentialsSection } = await import('@/components/classic/CredentialsViews')
  return render(
    <main>
      <mod.HeroSection />
      <mod.AboutSection />
      <mod.EducationSection />
      <mod.SkillsSection />
      <mod.ExperienceSection />
      <mod.ProjectsSection />
      <mod.PublicationsSection />
      <CredentialsSection />
      <mod.ContactSection />
    </main>,
    { wrapper: LocaleProvider },
  )
}

function revealTargets(): HTMLElement[] {
  return REVEALS.flatMap(spec => Array.from(document.querySelectorAll<HTMLElement>(spec.targets)))
}

describe('显形声明与页面标记一致', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubMatchMedia()
  })

  it('每条声明的 targets 在渲染出的 Classic 各区里都匹配到至少一个元素', async () => {
    await renderClassicSections()
    const dead = REVEALS.filter(spec => document.querySelectorAll(spec.targets).length === 0)
    expect(
      dead.map(s => `${s.name}: ${s.targets}`),
      '这些显形声明匹配不到任何元素 —— 动画从来没跑过，还会在线上打 gsap 空目标警告',
    ).toEqual([])
  })

  it('每条声明的 trigger 也存在 —— trigger 不存在时 ScrollTrigger 静默不建', async () => {
    await renderClassicSections()
    const missing = REVEALS.filter(spec => !document.querySelector(spec.trigger))
    expect(missing.map(s => `${s.name}: ${s.trigger}`)).toEqual([])
  })

  it('声明的 name 唯一 —— 重名会让排查时分不清哪条在动', () => {
    const names = REVEALS.map(s => s.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('挂载生命周期', () => {
  beforeEach(() => {
    window.localStorage.clear()
    reducedMotion = false
    stubMatchMedia()
    gsap.registerPlugin(ScrollTrigger)
  })
  afterEach(() => {
    ScrollTrigger.getAll().forEach(t => t.kill())
  })

  it('jsdom 里所有区都算「已滚过」——挂载后目标直接是终点态，不是等动画慢慢播', async () => {
    /*
      jsdom 的 getBoundingClientRect 全零：trigger 的 start = 0 − 0.75·innerHeight < 0、
      end = 0，scrollY 0 已在 end 之后 → 每个触发器 progress 都是 1。
      这正是「带 hash 进入、内容在视口上方」的形态：不该补播动画，而是直接呈现。
    */
    await renderClassicSections()
    const handle = mountScrollReveal()
    for (const el of revealTargets()) {
      expect(getComputedStyle(el).opacity, `${el.className.slice(0, 40)} 没到终点`).toBe('1')
    }
    handle.revert()
  })

  it('挂载 → 撤销 → 再挂载（StrictMode）之后没有残值', async () => {
    await renderClassicSections()
    const first = mountScrollReveal()
    /*
      模拟「tween 被杀在半路」留下的残值：第一次挂载的 tween 若被打断，元素会带着
      中间态的内联样式。修法必须让 revert 把它清掉，而不是让第二次挂载把它当终点。
    */
    const victim = revealTargets()[0]!
    victim.style.opacity = '0.42'
    victim.style.transform = 'scale(0.95)'
    first.revert()
    expect(victim.style.opacity, 'revert 没有清掉内联 opacity').toBe('')
    expect(victim.style.transform, 'revert 没有清掉内联 transform').toBe('')

    const second = mountScrollReveal()
    for (const el of revealTargets()) {
      expect(getComputedStyle(el).opacity).toBe('1')
      expect(el.style.transform === '' || el.style.transform === 'none', `${el.className.slice(0, 40)} 留了 transform`).toBe(true)
    }
    second.revert()
  })

  it('不碰别人的 ScrollTrigger —— getAll().kill() 那种清全局的写法是本次事故的一半', async () => {
    await renderClassicSections()
    const foreign = ScrollTrigger.create({ trigger: document.body, start: 'top top' })
    const handle = mountScrollReveal()
    handle.revert()
    expect(ScrollTrigger.getAll().includes(foreign), '别人的触发器被杀了').toBe(true)
    foreign.kill()
  })

  it('撤销后自己的触发器一个不留，且 revert 幂等', async () => {
    /*
      jsdom 里每个触发器一注册就 progress 1，`once: true` 让它在同一次 update 里自杀，
      所以"挂载后 getAll 变多"在这里断言不到——能断言的是撤销后回到基线、
      再撤销一次不炸（StrictMode 的 cleanup 与我们自己的 cancel 可能先后都调）。
    */
    await renderClassicSections()
    const before = ScrollTrigger.getAll().length
    const handle = mountScrollReveal()
    handle.revert()
    handle.revert()
    expect(ScrollTrigger.getAll().length).toBe(before)
  })

  it('监听 body 尺寸变化并在撤销时断开 —— 切语言后页面变短，触发点会漂到最大滚动之外', async () => {
    /*
      E2E 在 mobile-safari 上抓到的：切到中文后文案更短、页面变矮，联系区的 ScrollTrigger
      start 仍是挂载时算的像素值，被推到最大滚动之外，永远到不了。这里只验接线：
      挂载时 observe 了 body，撤销时 disconnect —— 不验 refresh 的效果（那是 gsap 的事）。
    */
    const observed: Element[] = []
    let disconnected = 0
    class FakeResizeObserver {
      observe(el: Element) { observed.push(el) }
      unobserve() {}
      disconnect() { disconnected += 1 }
    }
    const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver
    try {
      await renderClassicSections()
      const handle = mountScrollReveal()
      expect(observed).toEqual([document.body])
      handle.revert()
      expect(disconnected).toBe(1)
    } finally {
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = original
    }
  })

  it('prefers-reduced-motion 下不注册任何动画，DOM 原样', async () => {
    reducedMotion = true
    stubMatchMedia()
    await renderClassicSections()
    const before = ScrollTrigger.getAll().length
    const handle = mountScrollReveal()
    expect(ScrollTrigger.getAll().length).toBe(before)
    for (const el of revealTargets()) {
      expect(el.style.opacity).toBe('')
      expect(el.style.transform).toBe('')
    }
    handle.revert()
  })
})
