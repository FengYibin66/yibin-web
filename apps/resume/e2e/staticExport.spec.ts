import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { expect, test } from '@playwright/test'

/**
 * 静态导出结构的 E2E。
 *
 * 这组用例守的是 `output: 'export'` + `trailingSlash: true` 的产物形态
 * （ADR 20260822120803）。next.config.js 里那段注释记着一个真实故障：
 * 关掉 trailingSlash 时 `/gallery` 导出成 `gallery.html`，而 `public/gallery/`
 * 的照片资源又占了 `out/gallery/` 这个无 index 的目录，nginx 的 try_files 命中
 * 目录后对直接访问 `/gallery/` 返回 403。
 *
 * 单测覆盖不到这类问题——它只在「真实 HTTP 请求打到导出产物」时才出现。
 */

/**
 * 导出的全部路由，**从 out/ 自动发现**。
 *
 * 原先这里是手写清单（9 条），而实际导出 20 条——11 页从未被测过，
 * 且没有任何机制会提示。更糟的假绿场景：从 `generateStaticParams` 删掉一个 id，
 * `output:export` 会静默少导出那一页，线上 404，而 E2E 依然全绿。
 *
 * 现在扫目录，新增页面自动纳入覆盖，删页则会因少一条断言而被下面的
 * 「数量下限」用例发现。
 */
function discoverRoutes(): string[] {
  // 用 __dirname 而非 import.meta.dirname：apps/resume/package.json 没有
  // `"type":"module"`，playwright 以 CJS 加载 .spec.ts，import.meta 在那里会抛
  // "Cannot use 'import.meta' outside a module"。
  // （e2e/staticServer.mjs 是 .mjs 真 ESM，那里用 import.meta 没问题。）
  const outDir = resolve(__dirname, '../out')
  const routes: string[] = []

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      // _next 是构建产物，404 是错误页，都不是可访问路由
      if (entry.name === '_next' || entry.name === '404') continue
      const child = join(dir, entry.name)
      if (existsSync(join(child, 'index.html'))) {
        routes.push(`${prefix}${entry.name}/`)
      }
      walk(child, `${prefix}${entry.name}/`)
    }
  }

  if (existsSync(join(outDir, 'index.html'))) routes.push('/')
  walk(outDir, '/')
  return routes.sort()
}

const ROUTES = discoverRoutes()

test.describe('静态产物可达性', () => {
  test('自动发现的路由数量合理（防止发现逻辑退化成空数组）', () => {
    // 若 out/ 不存在或扫描逻辑坏了，ROUTES 会是空数组 → 下面的 for 循环
    // 一个断言都不生成 → 整组假绿。这条用例是那种失效的唯一症状。
    expect(
      ROUTES.length,
      '未发现任何导出路由。先跑 `pnpm build` 生成 out/，或检查 discoverRoutes()'
    ).toBeGreaterThanOrEqual(15)

    // 几条核心路由必须在内——防止扫描只捞到边缘页面
    for (const must of ['/', '/classic/', '/gallery/', '/lab/']) {
      expect(ROUTES, `核心路由 ${must} 未被发现`).toContain(must)
    }
  })

  for (const route of ROUTES) {
    test(`${route} 返回 200 且是 HTML`, async ({ request }) => {
      const res = await request.get(route)
      expect(res.status(), `${route} 应可直接访问`).toBe(200)
      expect(res.headers()['content-type']).toContain('text/html')

      const body = await res.text()
      // 不只看状态码：确认拿到的是真页面而非空壳或目录列表
      expect(body).toContain('<!DOCTYPE html>')
      expect(body.length, `${route} 的 HTML 体积异常小，疑为空壳`).toBeGreaterThan(1000)
    })
  }

  test('不带尾斜杠的路径也能到达（nginx 会 301，静态服务器同构）', async ({ request }) => {
    const res = await request.get('/classic')
    expect(res.status()).toBe(200)
  })

  test('不存在的路径返回 404，而不是 SPA 兜底成首页', async ({ request }) => {
    const res = await request.get('/this-route-does-not-exist/')
    expect(res.status()).toBe(404)
  })

  test('每个路由都有自己的 <title>，不是共用一个', async ({ request }) => {
    const titles = new Map<string, string>()
    for (const route of ['/classic/', '/gallery/', '/lab/']) {
      const body = await (await request.get(route)).text()
      // 用 [\s\S] 而非 /s 标志：本项目 tsconfig 的 target 低于 es2018，
      // dotAll 标志会报 TS1501。为一个测试改全项目 target 不值得。
      const title = /<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? ''
      expect(title, `${route} 缺少 title`).not.toBe('')
      titles.set(route, title)
    }
    expect(new Set(titles.values()).size, `title 重复：${[...titles]}`).toBe(titles.size)
  })
})

test.describe('Classic 简历页', () => {
  test('首屏渲染核心内容（服务端已产出，不依赖 JS）', async ({ page }) => {
    await page.goto('/classic/')
    await expect(page.getByRole('heading', { name: 'Yibin Feng', level: 1 })).toBeVisible()
    await expect(page.getByText('AI Research Engineer').first()).toBeVisible()
  })

  test('内容在禁用 JavaScript 时依然可读（SSG 的核心价值）', async ({ browser }) => {
    // 静态站的意义之一是无 JS 也能看。若这条失败说明内容退化成了客户端渲染。
    //
    // **必须同时断言 opacity。** Playwright 的 toBeVisible() 只看 display /
    // visibility / 尺寸，**不看 opacity**——所以一个 opacity:0 的元素在它眼里
    // 是「可见」的。这条用例曾因此假绿：framer-motion 的
    // `initial={{opacity:0}}` 在 SSR 时被写成内联样式，无 JS 时动画永不启动，
    // hero 区实际是一片空白，而测试一直绿着。
    // 修复见 app/layout.tsx 的 <noscript> 样式块。
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    try {
      const page = await ctx.newPage()
      await page.goto('/classic/')

      // 先证明 JS 真的关了。
      //
      // 不能用 page.evaluate 判断——Playwright 经 CDP 注入求值，即使页面 JS
      // 被禁用它自己仍能执行（这点曾让本用例误判失败）。可靠证据是
      // framer-motion **没有跑**：它若运行过会把入场动画的内联 opacity:0
      // 改写为 1。所以「内联样式仍含 opacity:0」既证明 JS 关着，
      // 又正好是本用例要考察的初始态。
      const motionEl = page.locator('[style*="opacity:0"]').first()
      const inlineStyle = (await motionEl.getAttribute('style')) ?? ''
      expect(
        inlineStyle,
        'framer-motion 若运行过会改写内联 opacity——说明 JS 并未真正禁用'
      ).toContain('opacity:0')

      // 再证明这些内容对人眼真的可见（靠 layout.tsx 的 <noscript> 覆盖）。
      //
      // **断言必须直接打在带内联 opacity:0 的那些元素上。**
      // 起初我用 getByText(...).first() 取元素再查 opacity，结果变异测试
      // （删掉 noscript 修复）依然全绿——因为 getByText 的 .first() 命中的是
      // 包含该文本的**祖先容器**，容器 opacity 是 1，而 opacity:0 在子元素上。
      // 断错了对象的断言，看起来严格实则无效。
      const faded = page.locator('[style*="opacity:0"]')
      const fadedCount = await faded.count()
      expect(
        fadedCount,
        'SSR 产物里应存在带内联 opacity:0 的入场动画元素，否则本用例无考察对象'
      ).toBeGreaterThan(0)

      for (let i = 0; i < fadedCount; i += 1) {
        const el = faded.nth(i)
        const info = await el.evaluate((node) => {
          const e = node as Element
          return {
            opacity: Number(getComputedStyle(e).opacity),
            text: (e.textContent ?? '').trim().slice(0, 40),
          }
        })
        expect(
          info.opacity,
          `无 JS 时「${info.text}」的计算 opacity 为 ${info.opacity}——` +
            `元素在 DOM 里但人眼看不见（<noscript> 覆盖未生效）`
        ).toBeGreaterThan(0.1)
      }

      // 关键文本确实在页面上（与上面的 opacity 检查互补：一个管「看得见」，
      // 一个管「内容真的被服务端渲染了」）
      for (const text of ['AI Research Engineer', 'TAL Education', 'About Me']) {
        await expect(
          page.getByText(text, { exact: false }).first(),
          `无 JS 时「${text}」应存在于静态 HTML`
        ).toBeVisible()
      }
    } finally {
      await ctx.close()
    }
  })

  test('导航到详情页并能返回', async ({ page }) => {
    await page.goto('/classic/experience/epic/')
    await expect(page.locator('body')).toContainText(/epic/i)

    await page.goto('/classic/')
    await expect(page.getByRole('heading', { name: 'Yibin Feng', level: 1 })).toBeVisible()
  })

  test('无控制台错误', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(String(err)))

    await page.goto('/classic/')
    await page.waitForLoadState('networkidle')

    expect(errors, `控制台报错：\n${errors.join('\n')}`).toEqual([])
  })
})

test.describe('语言切换', () => {
  // 这组是 LocaleProvider + localStorage 的端到端确认。单测层面它们曾整片失败
  // （16 个用例），根因是缺 Provider wrapper 与 Node 25 的 localStorage 全局。
  // 单测修好后仍需 E2E：真实浏览器里 localStorage 与 hydration 的交互是另一回事。
  //
  // ## 断言必须用「只在一种语言下出现」的文本
  //
  // 这组断言曾整片是空测试：原先断言「切换后『冯一镔』可见」「切回后
  // 『AI Research Engineer』可见」，但两个语言包**互相包含对方的这些字符串**——
  //   en.ts:24 有 nameZh:'冯一镔'          → 英文态下它本来就可见
  //   zh.ts:26 有 'AI Research Engineer'  → 中文态下它也可见
  // 于是即使点击是 no-op，断言照样通过。
  //
  // 现在改用实测互斥的一对：'About Me'（仅 en.ts:38）↔ '关于我'（仅 zh.ts:37），
  // 且**双向断言**——一种出现的同时另一种必须消失。单看「出现」不足以证明切换
  // 生效，因为两种语言的内容可能同时存在于 DOM。
  const EN_ONLY = 'About Me'
  const ZH_ONLY = '关于我'

  /**
   * 断言当前处于某语言：该语言的判别串**至少有一处可见**，
   * 另一语言的判别串完全不在 DOM 里。
   *
   * 不用 `.first()`：判别串在页面上出现两次——导航锚点 `<a>`（移动端视口下
   * 尺寸为 0×0，不可见）与正文标题 `<h2>`。DOM 顺序上锚点在前，于是
   * `.first()` 在 mobile-safari 下取到那个 0×0 元素并判定「不可见」而失败，
   * 而语言切换其实完全正常。断言应表达「有一处可见」，不该依赖 DOM 顺序。
   */
  async function expectLocale(page: import('@playwright/test').Page, locale: 'en' | 'zh') {
    const present = locale === 'en' ? EN_ONLY : ZH_ONLY
    const absent = locale === 'en' ? ZH_ONLY : EN_ONLY

    // 另一语言的判别串必须彻底消失——这是「切换真的发生了」的强证据
    await expect(page.getByText(absent, { exact: true })).toHaveCount(0)

    // 本语言的判别串至少一处可见
    const candidates = page.getByText(present, { exact: true })
    await expect(candidates.first()).toHaveCount(1) // 先确认存在
    const total = await candidates.count()
    let visible = 0
    for (let i = 0; i < total; i += 1) {
      if (await candidates.nth(i).isVisible()) visible += 1
    }
    expect(
      visible,
      `「${present}」在 DOM 里出现 ${total} 次但没有一处可见（${locale} 态）`
    ).toBeGreaterThan(0)
  }

  test('门户页右上角能切语言，进 Classic 后沿用', async ({ page }) => {
    /*
      门户（`/`）是全站唯一的入口，语言该在这里定。此前它只读语言、没有切换入口，
      用户得先进 Classic 再在 Navbar 里切（2026-09-04 补）。

      判别串：Classic 面板的眉题 'Classic Résumé' ↔ '常规简历'（labUi.entry.classicTitle），
      两个语言包互斥。**不能用 Lab 面板的标题**：手机端 `EntryStage` 走静态首帧路径，
      那块文案不渲染——第一版用 'The Lab' 在 mobile-safari 上直接找不到元素。
      进 Classic 之后用本组共用的 expectLocale。
    */
    await page.goto('/')
    const toggle = page.getByTestId('locale-toggle')
    await expect(toggle).toBeVisible()
    await expect(page.getByText('Classic Résumé', { exact: true })).toBeVisible()

    await toggle.click()
    await expect(page.getByText('常规简历', { exact: true })).toBeVisible()
    await expect(page.getByText('Classic Résumé', { exact: true })).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh')

    // 同一份偏好：进 Classic 不用再切
    await page.goto('/classic/')
    await expectLocale(page, 'zh')
  })

  test('判别串确实互斥（守住本组其余断言的前提）', async ({ page }) => {
    // 这条是元测试：若将来有人把 '关于我' 加进 en.ts（或反之），
    // 本组其余断言会重新退化为空测试。此处提前失败并指明原因。
    await page.goto('/classic/')
    await expect(
      page.getByText(EN_ONLY, { exact: true }).first(),
      `'${EN_ONLY}' 应出现在英文态`
    ).toHaveCount(1)
    await expect(
      page.getByText(ZH_ONLY, { exact: true }),
      `'${ZH_ONLY}' 不应出现在英文态。若它出现了，说明语言包互相污染，` +
        `本组断言会失去判别力——请换一对真正互斥的判别串。`
    ).toHaveCount(0)
  })

  test('点击切换到中文：中文判别串出现且英文判别串消失', async ({ page }) => {
    await page.goto('/classic/')
    await expectLocale(page, 'en')

    const toggle = page.getByTestId('locale-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()

    await expectLocale(page, 'zh')
  })

  test('选择在刷新后保持（hydration 真的恢复了渲染，不只是写了 storage）', async ({ page }) => {
    await page.goto('/classic/')
    await page.getByTestId('locale-toggle').click()
    await expectLocale(page, 'zh')
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('zh')

    await page.reload()
    // 关键：刷新后必须仍是中文态。SSR 产物固定是 en，所以这条真正验证了
    // 「hydration 后读 storage 并重渲染」——而不只是「storage 值还在」。
    await expectLocale(page, 'zh')
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('zh')
  })

  test('切回英文同样生效并持久化', async ({ page }) => {
    await page.goto('/classic/')
    /*
      用 `data-testid` 定位，不用 aria-label 也不用可见文字。

      语言切换按钮的 aria-label 刻意用**目标语言**写（en 下是"切换到中文"、
      zh 下是 "Switch to English"）——切换控件对读不懂当前语言的用户才可用。
      代价是按 aria-label 定位的 locator 切换之后必然失配。

      而 `getByRole(name)` 匹配的是**可访问名**（= aria-label），不是可见
      文字，所以退回按 '中文' / 'EN' 定位同样不成立（实测在 mobile-safari
      上超时）。既然两个自然把手都随语言变，就给一个不变的。
    */
    const toggle = page.getByTestId('locale-toggle')
    await toggle.click()
    await expectLocale(page, 'zh')
    await toggle.click()
    await expectLocale(page, 'en')
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('en')
  })

  test('切换语言同时更新 <html lang>（无障碍与 SEO 都依赖它）', async ({ page }) => {
    await page.goto('/classic/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByTestId('locale-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh')
  })
})

test.describe('主题切换', () => {
  // 真实契约（别照直觉猜，这里踩过两次）：
  //
  // 1. **深色是基线，浅色是覆盖层。** globals.css 只有 `[data-theme="light"]` 规则，
  //    深色由 `:root` 默认值提供。所以「无 data-theme 属性」与「data-theme="dark"」
  //    都正确渲染成深色——两种表示并存不是 bug。
  // 2. **首访时 <html> 上没有 data-theme 属性。** layout.tsx 的内联脚本是
  //    `if (t === 'light') setAttribute(...)`，只在存了 light 时才写属性。
  //    断言 `toMatch(/dark|light/)` 会拿到 null 而失败。
  // 3. **别断言 body 的 backgroundColor**：它是透明的 rgba(0,0,0,0)，
  //    配色靠 CSS 变量落在各元素上，从 body 背景看不到任何变化。

  /** 把两种深色表示归一，便于断言。 */
  const themeOf = (attr: string | null) => (attr === 'light' ? 'light' : 'dark')

  test('首访无 data-theme 属性（深色基线），点击后显式变浅色', async ({ page }) => {
    await page.goto('/classic/')
    const html = page.locator('html')
    const toggle = page.getByRole('button', { name: 'Toggle theme' })
    await expect(toggle).toBeVisible()

    // 首访：未存偏好 → 内联脚本不写属性
    expect(await html.getAttribute('data-theme')).toBeNull()

    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('再点一次回到深色（此时是显式 dark，仍渲染深色）', async ({ page }) => {
    await page.goto('/classic/')
    const html = page.locator('html')
    const toggle = page.getByRole('button', { name: 'Toggle theme' })

    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'light')

    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    // 显式 dark 不匹配任何 light 规则 → 与基线同色
    expect(themeOf(await html.getAttribute('data-theme'))).toBe('dark')
  })

  test('浅色选择在刷新后保持（内联脚本在绘制前恢复，无 FOUC）', async ({ page }) => {
    await page.goto('/classic/')
    const html = page.locator('html')

    await page.getByRole('button', { name: 'Toggle theme' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    expect(await page.evaluate(() => localStorage.getItem('resume-theme'))).toBe('light')

    await page.reload()
    // 属性必须在页面可交互前就位——这是内联脚本存在的全部意义
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('主题与语言两个偏好互不干扰', async ({ page }) => {
    // 两者都用 localStorage，键名不同（resume-theme / resume-locale）。
    // 切一个不该重置另一个。
    await page.goto('/classic/')
    await page.getByTestId('locale-toggle').click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()

    await page.getByRole('button', { name: 'Toggle theme' }).click()

    // 切主题后语言仍是中文
    await expect(page.getByText('冯一镔').first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('zh')
  })
})

test.describe('Gallery 路由', () => {
  // 验收报告 P1-3 已修：`GalleryTrack` 是 `dynamic(..., { ssr: false })`，
  // 原先没有 loading fallback，导出的 HTML 可见文本只有 <title>——
  // chunk 到位之前整页只剩背景色。现在补了两处加载态
  // （dynamic 的 loading + app/gallery/loading.tsx），静态产物里能看到它。

  test('静态产物自带加载态（无 JS 也不是一片空白）', async ({ request }) => {
    // 这条直接打在导出的 HTML 上，不经浏览器执行 JS——
    // 断言的正是「首屏那一刻用户看到什么」。
    const body = await (await request.get('/gallery/')).text()
    expect(body, 'Gallery 首屏应含加载提示，而非只有 <title>').toContain('Loading gallery')
    expect(body, '加载态应对读屏器可见').toContain('role="status"')
  })

  test('最终渲染出内容，不是永久空白', async ({ page }) => {
    await page.goto('/gallery/')
    await expect(page.locator('body')).not.toBeEmpty()
    // 给客户端 chunk 与图片留出时间；超时即意味着真的白屏
    await expect
      .poll(async () => (await page.locator('body').innerText()).trim().length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0)
  })

  test('直接访问不返回 403/404（历史故障：nginx try_files 命中无 index 的目录）', async ({
    request,
  }) => {
    for (const path of ['/gallery/', '/gallery']) {
      const res = await request.get(path)
      expect([200, 301, 308], `${path} 状态异常：${res.status()}`).toContain(res.status())
    }
  })
})
