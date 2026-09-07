import { expect, test, type Page } from '@playwright/test'

// 只 import 声明（纯数据），不 import 带 gsap 的运行时：Playwright 在 Node 里跑
import { REVEALS } from '../lib/animations/revealSpecs'

/**
 * Classic 页滚动显形的**进入路径**（2026-09-07）。
 *
 * 此前 E2E 只从顶部进过 `/classic/`。实机 bug 出在另一条从没走过的路：详情页点
 * 「返回简历」→ 客户端导航到 `/classic/#publications` → 往上滚，卡片停在半透明。
 * 这里把所有进入形态都走一遍：直接带 hash、详情返回、浏览器后退、切语言、
 * reduced-motion、顶部滚到底。断言对象是**每个显形目标的 computed opacity**，
 * 不是"页面没报错"。
 *
 * 第一版的四个坑，改它之前先读：
 *   1. hash 落点必须断言。第一版只断言"目标在 DOM 里 + 视口上方的都显形"，而 hash
 *      跳转根本没发生时视口上方没有目标——断言为真、用例空过。实际生产 `/classic/#publications`
 *      停在 scrollY 30（`scroll-behavior: smooth` 与 Lenis 互相抢），就是这么漏的。
 *   2. 「返回简历」只能按 testid 选：Navbar 里也有指向同一 hash 的链接，按 href 选在
 *      mobile-safari 上命中折叠不可见的那个，超时 30 秒。
 *   3. `sweep` 结尾要显式滚到底：按 0.6vh 步进到 `scrollHeight` 会差最后一小段，
 *      联系区 `top 80%` 的触发点永远到不了。
 *   4. SPA 回退没有 load 事件：`waitForURL` 默认等 load 会超时，用 `toHaveURL`。
 *
 * 程序化滚动一律 `behavior: 'instant'`（Lenis 会同步原生滚动并驱动 ScrollTrigger）。
 */

const SELECTORS = REVEALS.map(s => s.targets)
const HASHES = ['publications', 'experience', 'credentials', 'education'] as const

const pageErrors: string[] = []
test.beforeEach(({ page }) => {
  pageErrors.length = 0
  page.on('pageerror', e => { pageErrors.push(e.message) })
})
test.afterEach(() => {
  expect(pageErrors, '页面抛了未捕获异常').toEqual([])
})

/** 每个选择器下 opacity < 0.99 的元素；`onlyAboveViewport` 只看已滚过（bottom < 0）的 */
async function unrevealed(page: Page, onlyAboveViewport = false): Promise<string[]> {
  return page.evaluate(({ sels, onlyAbove }) => {
    const out: string[] = []
    for (const s of sels) {
      const els = Array.from(document.querySelectorAll<HTMLElement>(s))
      const pick = onlyAbove ? els.filter(e => e.getBoundingClientRect().bottom < 0) : els
      const low = pick.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.99)
      if (low.length) out.push(`${s}: ${low.length}/${pick.length} (min ${Math.min(...low.map(e => parseFloat(getComputedStyle(e).opacity))).toFixed(2)})`)
    }
    return out
  }, { sels: SELECTORS, onlyAbove: onlyAboveViewport })
}

/** hash 目标必须真的落在视口顶部附近（Navbar 遮挡的余量给 160px） */
async function expectHashInView(page: Page, id: string): Promise<void> {
  await expect.poll(
    () => page.evaluate(sel => Math.round(document.querySelector(sel)!.getBoundingClientRect().top), `#${id}`),
    { timeout: 4000, message: `#${id} 没有滚到视口顶部 —— hash 跳转被掐断了` },
  ).toBeLessThan(160)
  const top = await page.evaluate(sel => document.querySelector(sel)!.getBoundingClientRect().top, `#${id}`)
  expect(top, `#${id} 滚过头了`).toBeGreaterThan(-400)
}

/** 从顶到底分步滚一遍，最后显式落到底，让每个触发器都有机会开播 */
async function sweep(page: Page): Promise<void> {
  const { height, vh } = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, vh: window.innerHeight }))
  for (let y = 0; y <= height; y += Math.floor(vh * 0.6)) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' as ScrollBehavior }))
  await page.waitForTimeout(300)
}

async function expectAllRevealed(page: Page, note: string): Promise<void> {
  await expect.poll(() => unrevealed(page), { timeout: 8000, message: `${note}：这些目标没显形` }).toEqual([])
}

/**
 * 等滚动停下来。程序化跳转之后 Lenis 会再动一小段，这时点元素会落空
 * （chromium 上后退用例点论文卡没导航就是这么来的）。
 *
 * 判据是 `scrollY` 连续两次采样（隔 200ms）不变，**不是** `html.lenis-scrolling`
 * 类：触屏形态下 Lenis 把原生滚动标成 `native` 状态，那个类会长期挂着。
 */
async function settleScroll(page: Page): Promise<void> {
  await expect.poll(
    () => page.evaluate(async () => {
      const a = window.scrollY
      await new Promise(r => setTimeout(r, 200))
      return Math.abs(window.scrollY - a) < 1
    }),
    { timeout: 5000, message: '滚动一直没停' },
  ).toBe(true)
}

/** 等 hydration 完成：语言切换按钮由客户端渲染，它可见就说明 React 已接管 */
async function waitHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId('locale-toggle')).toBeVisible({ timeout: 20000 })
}

test.describe('Classic 滚动显形的进入路径', () => {
  for (const hash of HASHES) {
    test(`直接进 /classic/#${hash}：落在目标上，视口上方的内容立刻可见，滚一遍后全部可见`, async ({ page }) => {
      await page.goto(`/classic/#${hash}`)
      await expectHashInView(page, hash)
      // 中途到达：已滚过的内容不补播入场动画 —— 800ms 内就该在终点（动画本身要 0.6–1.7s）
      await expect.poll(() => unrevealed(page, true), { timeout: 800, message: '视口上方的目标应直接呈现' }).toEqual([])
      await sweep(page)
      await expectAllRevealed(page, `#${hash} 进入后滚一遍`)
    })
  }

  test('论文详情 → 返回简历 → 往上滚到 #projects：落在 #publications，卡片不残留半透明（原始事故路径）', async ({ page }) => {
    await page.goto('/classic/publications/03-social-norms/')
    await page.getByTestId('classic-back-link').click()
    // Next 的客户端导航会把 `/classic/#publications` 归一化成 `/classic#publications`（尾斜杠不保留）
    await expect(page).toHaveURL(/\/classic\/?#publications$/)
    await expectHashInView(page, 'publications')
    await page.evaluate(() => document.querySelector('#projects')!.scrollIntoView({ behavior: 'instant' as ScrollBehavior }))
    await expect.poll(
      () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('#projects .project-card, #experience .timeline-item, #skills .skill-badge'))
        .filter(e => parseFloat(getComputedStyle(e).opacity) < 0.99).length),
      { timeout: 6000, message: '返回后往上滚，卡片停在半透明' },
    ).toBe(0)
    await sweep(page)
    await expectAllRevealed(page, '详情返回后全页')
  })

  test('详情页 → 浏览器后退：显形完整', async ({ page }) => {
    await page.goto('/classic/')
    // 论文卡在折叠线下、显形前 opacity 0，Playwright 视为不可见点不到——用户也一样，先滚到它
    await page.evaluate(() => document.querySelector('#publications')!.scrollIntoView({ behavior: 'instant' as ScrollBehavior }))
    await settleScroll(page)
    const card = page.locator('a[href^="/classic/publications/"]').first()
    await expect(card).toBeVisible()
    // 卡片中心是封面的 ImagePreview 按钮（点了开灯箱、preventDefault），要点标题才是导航
    await card.getByRole('heading').first().click()
    await expect(page).toHaveURL(/\/classic\/publications\//)
    await page.goBack()
    await expect(page).toHaveURL(/\/classic\/(#.*)?$/)
    await sweep(page)
    await expectAllRevealed(page, '后退')
  })

  test('带 hash 进入后切语言：重渲染的卡片也全部可见', async ({ page }) => {
    await page.goto('/classic/#projects')
    await expectHashInView(page, 'projects')
    await page.getByTestId('locale-toggle').click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()
    await sweep(page)
    await expectAllRevealed(page, '切语言后')
  })

  test('顶部进入：折叠线下的目标先是隐藏的（动画真的注册了），滚到底后全部可见且 DOM 无痕', async ({ page }) => {
    await page.goto('/classic/')
    await expect(page.locator('#publications')).toBeAttached()
    // 显形在 hydration 之后的 rAF 里注册；并行跑 Lab 用例时 chromium 负载重，hydration 可能要几秒
    await waitHydrated(page)
    /*
      这条是对"全部可见"那些断言的变异防护：如果显形根本没注册（或被改成一律
      可见），上面所有用例照样绿。所以先证明它确实把折叠线下的东西藏起来了。
      探针用论文卡：它离首屏够远、数量固定。
    */
    await expect.poll(
      () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('#publications .publication-card'))
        .filter(e => parseFloat(getComputedStyle(e).opacity) < 0.05).length),
      { timeout: 8000, message: '论文卡在折叠线下，进入时应处于隐藏态' },
    ).toBeGreaterThan(0)
    await sweep(page)
    await expectAllRevealed(page, '顶部进入滚到底')
    // 完成后 clearProps：DOM 无痕，不留内联 opacity
    const inline = await page.evaluate(sels => sels.flatMap(s => Array.from(document.querySelectorAll<HTMLElement>(s))).filter(e => e.style.opacity !== '').length, SELECTORS)
    expect(inline, '动画完成后不该留内联 opacity').toBe(0)
  })

  test('prefers-reduced-motion：不注册动画，一切直接可见且 DOM 无痕', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/classic/')
    await expect(page.locator('#contact')).toBeAttached()
    await page.waitForTimeout(400)
    expect(await unrevealed(page)).toEqual([])
    const inline = await page.evaluate(sels => sels.flatMap(s => Array.from(document.querySelectorAll<HTMLElement>(s))).filter(e => e.style.opacity !== '' || e.style.transform !== '').length, SELECTORS)
    expect(inline, 'reduced-motion 下不该有任何内联样式').toBe(0)
  })
})
