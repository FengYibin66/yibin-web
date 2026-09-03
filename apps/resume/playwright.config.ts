import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 打在**静态导出产物**上，不打 `next dev`。
 *
 * 理由：resume 是 `output: 'export'` 的纯静态站（ADR 20260822120803），生产环境
 * 由 nginx 直接提供 `out/` 里的文件。`next dev` 有 HMR、按需编译、不同的路由解析，
 * 测它测不到真实部署形态——尤其是 `trailingSlash: true` 导致的 `dir/index.html`
 * 结构，那正是历史上 `/gallery` 直接访问返回 403 的根因所在。
 *
 * 所以 webServer 起一个朴素静态服务器指向 out/，跑测试前需先 `pnpm build`。
 */
const PORT = 4321

export default defineConfig({
  testDir: './e2e',
  // 静态站没有服务端状态，用例之间互不影响 → 可并行
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'html',

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 触屏形态单独跑：房间交互有 pointer 类型分支（见 publicationCard 的
      // 「does not reveal paint for touch pointers」单测），桌面用例覆盖不到。
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    // 用 Node 内置能力起静态服务，不引入额外依赖。
    command: `node e2e/staticServer.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
