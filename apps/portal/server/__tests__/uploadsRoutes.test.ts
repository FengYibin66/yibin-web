import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const STRONG_SECRET = 'u'.repeat(48)
const PASSWORD = 'upload-test-password'

// env 必须在 import 之前设好：uploads 路由在模块加载时就解析 UPLOADS_DIR
const UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'portal-uploads-'))
process.env.UPLOADS_DIR = UPLOAD_DIR
process.env.DB_URL = ':memory:'
process.env.SESSION_SECRET = STRONG_SECRET
process.env.ADMIN_PASSWORD = PASSWORD
process.env.NODE_ENV = 'test'

const { createApp } = await import('../src/app.js')
const app = createApp()

/** 各格式的合法魔数头，后面补足字节以通过长度检查。 */
const MAGIC = {
  png: Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 1),
  ]),
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(32, 1)]),
  webp: Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4, 0),
    Buffer.from('WEBP'),
    Buffer.alloc(32, 1),
  ]),
}

async function login(): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (res.status !== 200) throw new Error(`登录失败：${res.status}`)
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('登录未返回 Set-Cookie')
  return raw.split(/,(?=[^;]+=)/)[0]!.split(';')[0]!
}

function upload(
  bytes: Buffer,
  opts: { type: string; name: string; cookie?: string }
) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], opts.name, { type: opts.type }))
  return app.request('/api/uploads', {
    method: 'POST',
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    body: form,
  })
}

describe('uploads 路由', () => {
  let cookie: string

  beforeAll(async () => {
    cookie = await login()
  })

  afterAll(() => {
    rmSync(UPLOAD_DIR, { recursive: true, force: true })
  })

  describe('权限', () => {
    it('未登录时 401', async () => {
      const res = await upload(MAGIC.png, { type: 'image/png', name: 'a.png' })
      expect(res.status).toBe(401)
    })

    it('伪造的固定值 cookie 无法上传', async () => {
      const res = await upload(MAGIC.png, {
        type: 'image/png',
        name: 'a.png',
        cookie: 'portal_session=authenticated',
      })
      expect(res.status).toBe(401)
    })
  })

  describe('落盘扩展名由服务端决定（存储型 XSS 防线）', () => {
    it('声明 image/png 但文件名是 .html —— 落盘必须是 .png', async () => {
      // 这是核心攻击面：`/uploads/*` 由 serveStatic 按**扩展名**决定 Content-Type，
      // 若扩展名取自客户端文件名，攻击者可让浏览器把上传物当 HTML 执行（同源 XSS）。
      const res = await upload(MAGIC.png, {
        type: 'image/png',
        name: 'evil.html',
        cookie,
      })
      expect(res.status).toBe(200)
      const { path } = (await res.json()) as { path: string }
      expect(path.endsWith('.png'), `落盘路径为 ${path}，不应保留 .html`).toBe(true)
      expect(path).not.toContain('.html')
    })

    it.each([
      ['evil.svg', 'image/png', '.png'],
      ['evil.js', 'image/jpeg', '.jpg'],
      ['no-extension', 'image/webp', '.webp'],
      ['weird.PNG', 'image/png', '.png'],
    ])('文件名 %s + 类型 %s → 落盘 %s', async (name, type, expected) => {
      const bytes = type === 'image/jpeg' ? MAGIC.jpeg : type === 'image/webp' ? MAGIC.webp : MAGIC.png
      const res = await upload(bytes, { type, name, cookie })
      expect(res.status).toBe(200)
      const { path } = (await res.json()) as { path: string }
      expect(path.endsWith(expected)).toBe(true)
    })

    it('路径穿越形态的文件名不会写出 uploads 目录', async () => {
      const res = await upload(MAGIC.png, {
        type: 'image/png',
        name: '../../../../tmp/pwned.png',
        cookie,
      })
      expect(res.status).toBe(200)
      const { path } = (await res.json()) as { path: string }
      expect(path).not.toContain('..')
      // 实际落盘必须在 UPLOAD_DIR 内
      const written = readdirSync(UPLOAD_DIR)
      expect(written.some((f) => path.endsWith(f))).toBe(true)
    })
  })

  describe('内容与声明类型必须一致（魔数校验）', () => {
    it('声明 image/png 但内容是 HTML → 400', async () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>')
      const res = await upload(html, { type: 'image/png', name: 'x.png', cookie })
      expect(res.status).toBe(400)
      expect((await res.json() as { error: string }).error).toMatch(/does not match/i)
    })

    it('声明 image/png 但内容是 SVG → 400', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
      const res = await upload(svg, { type: 'image/png', name: 'x.png', cookie })
      expect(res.status).toBe(400)
    })

    it('声明 image/jpeg 但内容是 PNG → 400（类型必须与内容对应）', async () => {
      const res = await upload(MAGIC.png, { type: 'image/jpeg', name: 'x.jpg', cookie })
      expect(res.status).toBe(400)
    })

    it.each([
      ['image/png', 'png'],
      ['image/jpeg', 'jpeg'],
      ['image/webp', 'webp'],
    ] as const)('%s 的真实字节被接受', async (type, key) => {
      const res = await upload(MAGIC[key], { type, name: `ok.${key}`, cookie })
      expect(res.status).toBe(200)
    })
  })

  describe('类型与大小校验', () => {
    it('不在白名单的类型 → 400', async () => {
      for (const type of ['image/svg+xml', 'text/html', 'application/pdf', 'image/gif']) {
        const res = await upload(MAGIC.png, { type, name: 'x.bin', cookie })
        expect(res.status, `${type} 应被拒绝`).toBe(400)
      }
    })

    it('超过 5MB → 400', async () => {
      const big = Buffer.concat([MAGIC.png, Buffer.alloc(5 * 1024 * 1024 + 1, 0)])
      const res = await upload(big, { type: 'image/png', name: 'big.png', cookie })
      expect(res.status).toBe(400)
      expect((await res.json() as { error: string }).error).toMatch(/too large/i)
    })

    it('没有 file 字段 → 400', async () => {
      const res = await app.request('/api/uploads', {
        method: 'POST',
        headers: { cookie },
        body: new FormData(),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('并发不互相覆盖', () => {
    it('同一毫秒内的多次上传各自落盘', async () => {
      // 原实现文件名只用 Date.now()，同毫秒的两个请求后者直接覆盖前者。
      const before = readdirSync(UPLOAD_DIR).length
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          upload(MAGIC.png, { type: 'image/png', name: `c${i}.png`, cookie })
        )
      )
      for (const r of results) expect(r.status).toBe(200)

      const paths = await Promise.all(
        results.map(async (r) => ((await r.json()) as { path: string }).path)
      )
      expect(new Set(paths).size, `返回的路径有重复：${paths.join(', ')}`).toBe(8)
      expect(readdirSync(UPLOAD_DIR).length).toBe(before + 8)
    })
  })

  describe('落盘内容正确', () => {
    it('写入的字节与上传一致', async () => {
      const payload = Buffer.concat([MAGIC.png, Buffer.from('marker-bytes')])
      const res = await upload(payload, { type: 'image/png', name: 'm.png', cookie })
      const { path } = (await res.json()) as { path: string }
      const onDisk = readFileSync(join(UPLOAD_DIR, path.replace('/uploads/', '')))
      expect(onDisk.equals(payload)).toBe(true)
    })
  })
})
