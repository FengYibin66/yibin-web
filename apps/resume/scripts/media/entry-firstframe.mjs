#!/usr/bin/env node
/**
 * 入口页的静态首帧（手机端不挂 Canvas 的前提）。
 *
 * ## 问题
 *
 * 入口页要先下 1553 KB 的脚本（three.js + R3F）再编译 shader 才能画出那扇门。
 * 桌面上 canvas 约 590ms 出现，手机上更久，而这段时间面板是空的、文案却在说
 * 「点这扇门」。手机访客为了一扇**静止的门**下载整个 3D 运行时。
 *
 * ## 做法
 *
 * 把那扇门渲成一张 webp，随 HTML 直出。手机端渲染这张图（可点、可键盘），
 * 点了播 CSS 开门动画再跳 `/lab`——完全不挂 Canvas。桌面端不变
 * （见 `components/entry/EntryStage.tsx` 顶部的取舍说明）。
 *
 * ## 为什么用截图而不是拼贴
 *
 * 门的构图来自 3D 场景（透视、光照、猫和植物的位置都在场景里算），用 sharp
 * 拼 `public/textures/entrance/` 那些贴图拼不出同一个画面。截图是唯一能保证
 * 「静态图与 Canvas 接管后完全一致」的办法。
 *
 * 代价是这个脚本需要**已构建的 `out/`** 与一个浏览器。它和门贴纸、字体子集
 * 一样是换素材时才跑的离线步骤，不进 CI 的生成路径（CI 只跑 `--check`）。
 *
 * 用法：
 *   pnpm build && node scripts/media/entry-firstframe.mjs
 *   node scripts/media/entry-firstframe.mjs --check
 */
import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const require = createRequire(import.meta.url)
const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../..')
const OUT_FILE = join(APP, 'public/entry/door-firstframe.webp')

/**
 * 截图口径。
 *
 * 手机端是竖屏单列，门那一半占满宽度。取 828×1000 是因为：
 *   - 828 = 414（iPhone 逻辑宽度）× 2，覆盖 2x DPR
 *   - 1000 高度覆盖竖屏时门那一半的可视区（约 50vh，最高的机型也够）
 *
 * 截的是**桌面视口的左半**而不是手机视口：手机视口下门会被裁掉两侧，
 * 而这张图要能在不同宽度下 `object-fit: cover`。
 */
const SHOT = { width: 828, height: 1000 }
const VIEWPORT = { width: 1656, height: 1000 }

const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  /*
    这一条只查**存在性**，不查指纹。

    它的源不是文件而是"整个已构建的站点"——3D 场景、贴图、字体、布局任何
    一处变了首帧就该重截。给这个算指纹等于给整个 `out/` 算指纹，那不如
    直接重截。所以这里只守最要紧的一条：文件在不在（不在的话手机端是一块
    空白，而那条路径桌面开发时看不到）。
  */
  const ok = existsSync(OUT_FILE)
  console.log(ok
    ? `  · door-firstframe.webp  已存在（${Math.round(statSync(OUT_FILE).size / 1024)} KB）`
    : '  ! door-firstframe.webp  不存在，跑 pnpm build && node scripts/media/entry-firstframe.mjs')
  process.exit(ok ? 0 : 1)
}

const outDir = join(APP, 'out')
if (!existsSync(outDir)) {
  console.error('  ✗ 需要先构建：pnpm build')
  process.exit(1)
}

const { chromium } = require('@playwright/test')
const { createServer } = await import('node:http')
const { readFile } = await import('node:fs/promises')
const { extname } = await import('node:path')

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
}

/*
  临时静态服务器。刻意**不做 SPA fallback**——找不到就 404，与
  `e2e/staticServer.mjs` 同一条纪律：自动兜底会把"文件根本没导出"掩盖成
  "页面正常"。
*/
const server = createServer(async (req, res) => {
  try {
    const path = (req.url ?? '/').split('?')[0]
    const file = path.endsWith('/') ? join(outDir, path, 'index.html') : join(outDir, path)
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise(resolve => server.listen(0, resolve))
const port = server.address().port

const browser = await chromium.launch({
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })

/*
  截图时要把两样东西藏掉：
  - DOM 覆盖层的文案（"ENTER / The Lab / …"）——手机端会用真实的 DOM 文案
    叠在这张图上，图里再有一份就是两层字
  - ExplorerBar（底部那条），它不属于门
*/
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })
// 等 3D 场景稳定：canvas 出现之后再给它时间加载纹理并画满
await page.waitForFunction(() => {
  const c = document.querySelector('canvas')
  return !!c && c.clientWidth > 0
}, null, { timeout: 60000 })
await page.waitForTimeout(6000)

/*
  截图前藏掉两样不属于门的东西：DOM 覆盖层的文案（手机端会用真实文案叠在
  这张图上，图里再有一份就是两层字）与底部的 ExplorerBar。

  用 `addStyleTag`（导航之后）而不是 `addInitScript`：init script 在
  document start 就跑，那时 `document.documentElement` 可能还不存在，
  `.append` 一抛异常**整段脚本静默失效**——两条规则一起没生效，而截图照常
  成功。第一版就是这样把"The Lab"和"EXPLORER"都烤进了图里。
*/
await page.addStyleTag({
  content: `
    a[href="/lab"] * { opacity: 0 !important; }
    [data-explorer-bar] { display: none !important; }
  `,
})
await page.waitForTimeout(300)

const raw = await page.screenshot({
  clip: { x: 0, y: 0, width: VIEWPORT.width / 2, height: VIEWPORT.height },
})

await browser.close()
server.close()

await sharp(raw)
  .resize(SHOT.width, SHOT.height, { fit: 'cover' })
  .webp({ quality: 82, effort: 6 })
  .toFile(OUT_FILE)

console.log(
  `  ✓ door-firstframe.webp  ${SHOT.width}x${SHOT.height}  ` +
  `${Math.round(statSync(OUT_FILE).size / 1024)} KB`,
)
