// Portal uploads — MVP: local volume + /uploads/* (see docs/specs/portal-media.md).
// TODO(phase-2): COS + CDN; replace with MediaStore + avatarUrl, remove this route.
import { Hono } from 'hono'
import { writeFile, mkdir } from 'fs/promises'
import { randomBytes } from 'crypto'
import { resolve } from 'path'
import { requireAuth } from '../auth.js'

export const uploadsRouter = new Hono()

const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? '../uploads')
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * 允许的图片类型，以及**由服务端决定**的落盘扩展名。
 *
 * 扩展名必须从这张表来，不能取自客户端的文件名。
 * 原实现用 `extname(file.name)`，于是一个名为 `x.html`、`type` 谎报
 * `image/png` 的上传会落盘成 `.html`——`/uploads/*` 由 serveStatic 按扩展名
 * 决定 Content-Type，浏览器会把它当 HTML 执行，构成**同源存储型 XSS**。
 * cookie 是 HttpOnly，但同源脚本可以直接调用管理接口，等于绕过了整个后台。
 */
const ALLOWED: Record<string, { ext: string; sniff: (b: Buffer) => boolean }> = {
  'image/jpeg': {
    ext: '.jpg',
    // FF D8 FF
    sniff: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/png': {
    ext: '.png',
    // 89 50 4E 47 0D 0A 1A 0A
    sniff: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  'image/webp': {
    ext: '.webp',
    // "RIFF" .... "WEBP"
    sniff: (b) =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
}

uploadsRouter.post('/', requireAuth, async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }

  const spec = ALLOWED[file.type]
  if (!spec) {
    return c.json({ error: 'Only JPEG, PNG, WebP allowed' }, 400)
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 5MB)' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 按真实字节数再查一次上限：file.size 来自 multipart 头部，不该单独作为依据
  if (buffer.length > MAX_SIZE) {
    return c.json({ error: 'File too large (max 5MB)' }, 400)
  }

  // 魔数校验：`file.type` 是客户端自报的，光信它等于没校验。
  // 内容与声明的类型不符一律拒绝——挡住「.png 外衣里装 HTML/SVG/脚本」。
  if (!spec.sniff(buffer)) {
    return c.json({ error: 'File content does not match its declared type' }, 400)
  }

  await mkdir(UPLOADS_DIR, { recursive: true })

  // 文件名由服务端完全决定：时间戳仅为可读性，随机后缀防同毫秒并发覆盖
  // （原实现只用 Date.now()，两个请求落在同一毫秒时后者直接覆盖前者）。
  // 扩展名取自上面的白名单，与客户端文件名无关。
  const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${spec.ext}`
  const filepath = resolve(UPLOADS_DIR, filename)

  // 防御性断言：filename 由我们自己拼出，理论上不含分隔符；
  // 万一将来改动引入了，这里会挡住写到 UPLOADS_DIR 之外。
  if (!filepath.startsWith(UPLOADS_DIR)) {
    return c.json({ error: 'Invalid upload path' }, 400)
  }

  await writeFile(filepath, buffer)

  return c.json({ path: `/uploads/${filename}` })
})
