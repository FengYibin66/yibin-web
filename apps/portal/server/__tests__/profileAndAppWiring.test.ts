import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const STRONG_SECRET = 'p'.repeat(48)
const PASSWORD = 'profile-test-password'

process.env.DB_URL = ':memory:'
process.env.SESSION_SECRET = STRONG_SECRET
process.env.ADMIN_PASSWORD = PASSWORD
process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173,https://www.yibinfeng.com'

const { createApp } = await import('../src/app.js')
const { client: raw } = await import('../src/db/index.js')
const { resolveDbUrl } = await import('../src/db/index.js')
const { applyMigrations } = await import('./helpers/testDb.js')

const app = createApp()

const VALID_PROFILE = {
  nameEn: 'Yibin Feng',
  nameZh: '冯一镔',
  bioEn: 'AI Engineer',
  bioZh: 'AI 工程师',
  avatarPath: '/uploads/avatar.jpg',
  github: 'https://github.com/x',
  linkedin: 'https://linkedin.com/in/x',
  email: 'a@b.com',
}

async function login(): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (res.status !== 200) throw new Error(`登录失败：${res.status}`)
  return res.headers.get('set-cookie')!.split(/,(?=[^;]+=)/)[0]!.split(';')[0]!
}

function put(body: unknown, cookie?: string) {
  return app.request('/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe('profile 路由', () => {
  beforeAll(async () => {
    await applyMigrations(raw)
  })

  beforeEach(async () => {
    await raw.execute('DELETE FROM profile')
  })

  it('GET 是公开的；无数据时返回 null', async () => {
    const res = await app.request('/api/profile')
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('PUT 未登录时 401', async () => {
    const res = await put(VALID_PROFILE)
    expect(res.status).toBe(401)
  })

  it('伪造的固定值 cookie 无法改档案', async () => {
    const res = await put(VALID_PROFILE, 'portal_session=authenticated')
    expect(res.status).toBe(401)
  })

  it('PUT 首次写入即 upsert 出 id=1 的行', async () => {
    const res = await put(VALID_PROFILE, await login())
    expect(res.status).toBe(200)
    const row = (await res.json()) as { id: number; nameEn: string; updatedAt: number }
    expect(row.id).toBe(1)
    expect(row.nameEn).toBe('Yibin Feng')
    expect(row.updatedAt).toBeGreaterThan(0)
  })

  it('PUT 二次写入是更新而非插入新行（onConflictDoUpdate）', async () => {
    const cookie = await login()
    await put(VALID_PROFILE, cookie)
    const res = await put({ ...VALID_PROFILE, nameEn: 'Renamed' }, cookie)
    expect(res.status).toBe(200)
    expect((await res.json() as { nameEn: string }).nameEn).toBe('Renamed')

    const count = await raw.execute('SELECT COUNT(*) AS n FROM profile')
    expect(Number(count.rows[0]!.n)).toBe(1)
  })

  it('updatedAt 是秒级时间戳（不是毫秒）', async () => {
    const res = await put(VALID_PROFILE, await login())
    const { updatedAt } = (await res.json()) as { updatedAt: number }
    const nowSeconds = Math.floor(Date.now() / 1000)
    // 毫秒值会比秒值大三个数量级，这条能抓住单位写错
    expect(Math.abs(updatedAt - nowSeconds)).toBeLessThan(60)
  })

  it('GET 在写入后返回该行', async () => {
    await put(VALID_PROFILE, await login())
    const res = await app.request('/api/profile')
    expect((await res.json() as { nameZh: string }).nameZh).toBe('冯一镔')
  })

  describe('校验', () => {
    it('非法 email → 400', async () => {
      const res = await put({ ...VALID_PROFILE, email: 'not-an-email' }, await login())
      expect(res.status).toBe(400)
    })

    it('空 nameEn → 400', async () => {
      const res = await put({ ...VALID_PROFILE, nameEn: '' }, await login())
      expect(res.status).toBe(400)
    })

    it('缺字段 → 400', async () => {
      const { bioEn: _omit, ...partial } = VALID_PROFILE
      const res = await put(partial, await login())
      expect(res.status).toBe(400)
    })
  })
})

describe('auth 的其余端点', () => {
  it('GET /api/auth/me 未登录时 401', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me 登录后返回 authenticated', async () => {
    const res = await app.request('/api/auth/me', { headers: { cookie: await login() } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ authenticated: true })
  })

  it('POST /api/auth/logout 未登录时 401', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('登出会下发清除 cookie 的响应头', async () => {
    const cookie = await login()
    const res = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    // deleteCookie 通过 Max-Age=0 / 过期时间让浏览器丢弃它
    expect(setCookie).toMatch(/portal_session=/)
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i)
  })

  it('登出后旧 cookie 仍能用 —— 无状态签名的已知取舍', async () => {
    // 这条不是 bug 而是 ADR 20260822132001 明列的选项 B 代价：
    // 签名是无状态的，服务端不保存会话表，因此无法单独吊销某个 cookie。
    // 登出只让**浏览器**丢弃它。写成用例是为了把这个语义钉住——
    // 若将来改成有状态会话，这条会红，提醒同步更新 ADR。
    const cookie = await login()
    await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })
    const after = await app.request('/api/auth/me', { headers: { cookie } })
    expect(after.status).toBe(200)
  })
})

describe('resolveDbUrl', () => {
  it('DB_URL 优先', () => {
    expect(resolveDbUrl({ DB_URL: 'libsql://x', DB_PATH: '/tmp/a.db' } as NodeJS.ProcessEnv))
      .toBe('libsql://x')
  })

  it('无 DB_URL 时用 DB_PATH 并加 file: 前缀', () => {
    const out = resolveDbUrl({ DB_PATH: '/tmp/a.db' } as NodeJS.ProcessEnv)
    expect(out.startsWith('file:')).toBe(true)
    expect(out).toContain('/tmp/a.db')
  })

  it('两者都缺时回退到默认路径', () => {
    const out = resolveDbUrl({} as NodeJS.ProcessEnv)
    expect(out.startsWith('file:')).toBe(true)
    expect(out).toContain('portal.db')
  })

  it('相对 DB_PATH 被解析为绝对路径', () => {
    const out = resolveDbUrl({ DB_PATH: './rel.db' } as NodeJS.ProcessEnv)
    expect(out).toMatch(/^file:\//)
  })
})

describe('CORS 白名单', () => {
  const original = process.env.CLIENT_ORIGIN

  afterEach(() => {
    process.env.CLIENT_ORIGIN = original
  })

  it('白名单内的 origin 被回显', async () => {
    const res = await app.request('/api/health', {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('白名单外的 origin 不回显（credentials 下不得反射任意来源）', async () => {
    const res = await app.request('/api/health', {
      headers: { origin: 'https://evil.example.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('多值白名单的第二项也生效（split/trim 正确）', async () => {
    const res = await app.request('/api/health', {
      headers: { origin: 'https://www.yibinfeng.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://www.yibinfeng.com')
  })

  it('非 /api/* 路径不挂 CORS 中间件', async () => {
    const res = await app.request('/health', {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
