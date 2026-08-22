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

/** 导出的全部路由。新增页面时同步补进来，漏了这里就等于没有 E2E 覆盖。 */
const ROUTES = [
  '/',
  '/classic/',
  '/classic/credentials/',
  '/classic/education/imperial/',
  '/classic/education/nus/',
  '/classic/experience/epic/',
  '/classic/publications/01-social-groups/',
  '/gallery/',
  '/lab/',
] as const

test.describe('静态产物可达性', () => {
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
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    try {
      const page = await ctx.newPage()
      await page.goto('/classic/')
      await expect(page.getByText('AI Research Engineer').first()).toBeVisible()
      await expect(page.getByText('TAL Education').first()).toBeVisible()
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

  test('点击切换后中文内容出现', async ({ page }) => {
    await page.goto('/classic/')
    const toggle = page.getByRole('button', { name: 'Toggle language' })
    await expect(toggle).toBeVisible()

    await toggle.click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()
  })

  test('选择在刷新后保持（写入 localStorage）', async ({ page }) => {
    await page.goto('/classic/')
    await page.getByRole('button', { name: 'Toggle language' }).click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('resume-locale'))
    expect(stored).toBe('zh')

    await page.reload()
    // hydration 后应恢复为 zh，而非闪回 en 就停住
    await expect(page.getByText('冯一镔').first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('zh')
  })

  test('切回英文同样生效并持久化', async ({ page }) => {
    await page.goto('/classic/')
    const toggle = page.getByRole('button', { name: 'Toggle language' })
    await toggle.click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()

    await toggle.click()
    await expect(page.getByText('AI Research Engineer').first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('en')
  })

  test('切换语言同时更新 <html lang>（无障碍与 SEO 都依赖它）', async ({ page }) => {
    await page.goto('/classic/')
    await page.getByRole('button', { name: 'Toggle language' }).click()
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
    await page.getByRole('button', { name: 'Toggle language' }).click()
    await expect(page.getByText('冯一镔').first()).toBeVisible()

    await page.getByRole('button', { name: 'Toggle theme' }).click()

    // 切主题后语言仍是中文
    await expect(page.getByText('冯一镔').first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('resume-locale'))).toBe('zh')
  })
})

test.describe('Gallery 路由', () => {
  // 验收报告 P1-3：Gallery 走独立路由、动态 import 且 ssr:false、无 loading UI，
  // 首次进入会短暂白屏。导出的 HTML 里可见文本确实只有 <title>。
  // 这条用例不判定「有没有 loading 态」（那是待修项），只钉住底线：
  // **最终必须渲染出内容，不能永久空白**。P1-3 修完后可再加 loading 态断言。

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
