#!/usr/bin/env node
/**
 * 服务 `out/` 的极简静态服务器，供 E2E 使用。
 *
 * 刻意手写而不引第三方包：要模拟的是 nginx 对 `trailingSlash: true` 导出结构的
 * 解析方式（`/gallery/` → `out/gallery/index.html`），而现成的 dev server 各有
 * 各的兜底策略（有的自动 SPA fallback 到 index.html），那会把「页面根本没导出」
 * 这类真实故障掩盖成「页面正常」。这里**不做 SPA fallback**：找不到就 404，
 * 让缺页在测试里直接暴露。
 *
 * 用法：node e2e/staticServer.mjs [port]
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../out')
const PORT = Number(process.argv[2] ?? 4321)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
}

if (!existsSync(ROOT)) {
  console.error(`[staticServer] 找不到 ${ROOT}——先跑 \`pnpm build\` 生成静态产物`)
  process.exit(1)
}

/** 把 URL 路径解析为磁盘文件；越权路径与缺失文件都返回 null。 */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  // 归一化后必须仍在 ROOT 内，挡住 ../ 穿越
  const candidate = normalize(join(ROOT, decoded))
  if (!candidate.startsWith(ROOT)) return null

  if (existsSync(candidate)) {
    const st = statSync(candidate)
    if (st.isFile()) return candidate
    // 目录 → 找 index.html（trailingSlash: true 的导出结构）
    const indexed = join(candidate, 'index.html')
    if (existsSync(indexed)) return indexed
    return null
  }

  // `/classic` 这类不带尾斜杠的请求：next 导出的是 `classic/index.html`
  const withIndex = join(candidate, 'index.html')
  if (existsSync(withIndex)) return withIndex

  // `/classic` → `classic.html`（trailingSlash 关闭时的形态，留作兼容）
  const asHtml = `${candidate}.html`
  if (existsSync(asHtml)) return asHtml

  return null
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url ?? '/')

  if (!file) {
    // 不做 SPA fallback——缺页必须以 404 暴露，见文件头说明
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`404 Not Found: ${req.url}`)
    return
  }

  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[staticServer] 服务 ${ROOT} → http://127.0.0.1:${PORT}/`)
})

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)))
}
