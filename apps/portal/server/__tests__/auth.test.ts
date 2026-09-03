import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AUTH_INTERNALS, passwordMatches, requireAuth, setSession } from '../src/auth.js'

const STRONG_SECRET = 'a'.repeat(48)
const PASSWORD = 'correct-horse-battery-staple'

/** 一个最小应用：一条签发会话的路由 + 一条受保护路由。 */
function buildApp() {
  const app = new Hono()
  app.post('/login', async (c) => {
    if (!passwordMatches(await c.req.text(), process.env.ADMIN_PASSWORD)) {
      return c.json({ error: 'Invalid password' }, 401)
    }
    const ok = await setSession(c)
    return ok ? c.json({ ok: true }) : c.json({ error: 'misconfigured' }, 500)
  })
  app.get('/protected', requireAuth, (c) => c.json({ secret: 'data' }))
  return app
}

/** 从 Set-Cookie 里取出会话 cookie，形如 `portal_session=...`。 */
function sessionCookieFrom(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('响应里没有 Set-Cookie')
  const first = raw.split(/,(?=[^;]+=)/)[0]!
  return first.split(';')[0]!
}

describe('会话认证', () => {
  const original = { ...process.env }

  beforeEach(() => {
    process.env.SESSION_SECRET = STRONG_SECRET
    process.env.ADMIN_PASSWORD = PASSWORD
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    process.env = { ...original }
  })

  describe('伪造防护（修复前的漏洞）', () => {
    it('拒绝手工构造的固定值 cookie —— 这正是修复前可绕过登录的方式', async () => {
      const app = buildApp()
      // 修复前 requireAuth 只比较字面量 'authenticated'，这一行就是完整的认证绕过
      const res = await app.request('/protected', {
        headers: { cookie: `${AUTH_INTERNALS.SESSION_COOKIE}=authenticated` },
      })
      expect(res.status).toBe(401)
    })

    it('拒绝无签名的任意值 cookie', async () => {
      const app = buildApp()
      for (const value of ['1', 'true', 'admin', String(Date.now())]) {
        const res = await app.request('/protected', {
          headers: { cookie: `${AUTH_INTERNALS.SESSION_COOKIE}=${value}` },
        })
        expect(res.status, `值 ${value} 不应被接受`).toBe(401)
      }
    })

    it('拒绝签名被改动过的 cookie', async () => {
      const app = buildApp()
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      const cookie = sessionCookieFrom(login)

      // 翻掉签名最后一个字符
      const last = cookie.slice(-1)
      const tampered = cookie.slice(0, -1) + (last === 'A' ? 'B' : 'A')
      expect(tampered).not.toBe(cookie)

      const res = await app.request('/protected', { headers: { cookie: tampered } })
      expect(res.status).toBe(401)
    })

    it('拒绝用别的 secret 签出的 cookie', async () => {
      const app = buildApp()
      process.env.SESSION_SECRET = 'b'.repeat(48)
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      const foreignCookie = sessionCookieFrom(login)

      // 换回正确 secret 后，上面那张 cookie 必须失效
      process.env.SESSION_SECRET = STRONG_SECRET
      const res = await app.request('/protected', { headers: { cookie: foreignCookie } })
      expect(res.status).toBe(401)
    })

    it('无 cookie 时拒绝', async () => {
      const res = await buildApp().request('/protected')
      expect(res.status).toBe(401)
    })
  })

  describe('正常流程', () => {
    it('密码正确 → 签发会话 → 可访问受保护资源', async () => {
      const app = buildApp()
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      expect(login.status).toBe(200)

      const res = await app.request('/protected', {
        headers: { cookie: sessionCookieFrom(login) },
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ secret: 'data' })
    })

    it('会话 cookie 带 HttpOnly 与 Path，防脚本读取', async () => {
      const app = buildApp()
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      const raw = login.headers.get('set-cookie') ?? ''
      expect(raw).toMatch(/HttpOnly/i)
      expect(raw).toMatch(/Path=\//i)
    })

    it('生产环境下带 Secure 标记', async () => {
      process.env.NODE_ENV = 'production'
      const app = buildApp()
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      expect(login.headers.get('set-cookie') ?? '').toMatch(/Secure/i)
    })

    it('密码错误 → 401 且不签发 cookie', async () => {
      const app = buildApp()
      const res = await app.request('/login', { method: 'POST', body: 'wrong' })
      expect(res.status).toBe(401)
      expect(res.headers.get('set-cookie')).toBeNull()
    })
  })

  describe('过期判定（服务端独立校验，不信任浏览器）', () => {
    it('签发时刻超出有效期的会话被拒', async () => {
      const app = buildApp()
      const realNow = Date.now
      try {
        // 签发时把时钟拨到「有效期 + 1 小时」之前
        const staleMs = realNow() - (AUTH_INTERNALS.SESSION_MAX_AGE_SECONDS + 3600) * 1000
        Date.now = () => staleMs
        const login = await app.request('/login', { method: 'POST', body: PASSWORD })
        const cookie = sessionCookieFrom(login)

        Date.now = realNow
        const res = await app.request('/protected', { headers: { cookie } })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: 'Session expired' })
      } finally {
        Date.now = realNow
      }
    })

    it('签发时刻在未来（超出时钟偏差容许）的会话被拒', async () => {
      const app = buildApp()
      const realNow = Date.now
      try {
        Date.now = () => realNow() + 10 * 60 * 1000 // 未来 10 分钟
        const login = await app.request('/login', { method: 'POST', body: PASSWORD })
        const cookie = sessionCookieFrom(login)

        Date.now = realNow
        const res = await app.request('/protected', { headers: { cookie } })
        expect(res.status).toBe(401)
      } finally {
        Date.now = realNow
      }
    })

    it('有效期内的会话通过', async () => {
      const app = buildApp()
      const realNow = Date.now
      try {
        Date.now = () => realNow() - 60 * 1000 // 1 分钟前签发
        const login = await app.request('/login', { method: 'POST', body: PASSWORD })
        const cookie = sessionCookieFrom(login)

        Date.now = realNow
        const res = await app.request('/protected', { headers: { cookie } })
        expect(res.status).toBe(200)
      } finally {
        Date.now = realNow
      }
    })
  })

  describe('配置缺失时 fail-closed', () => {
    it('SESSION_SECRET 未设置 → 受保护路由返回 500 而非放行', async () => {
      delete process.env.SESSION_SECRET
      const res = await buildApp().request('/protected')
      expect(res.status).toBe(500)
    })

    it('SESSION_SECRET 过短（<32）→ 视为未配置', async () => {
      process.env.SESSION_SECRET = 'short'
      const res = await buildApp().request('/protected')
      expect(res.status).toBe(500)
    })

    it('长度够但仍是占位值 → 视为未配置', async () => {
      // config/env.shared.example 的占位值恰好 33 字符，能通过 ≥32 的长度检查。
      // 若只查长度，运维漏填 + 忽略 env-build 退出码就会让生产用一个
      // 任何读过本仓库的人都知道的 HMAC key 运行。
      const placeholder = 'CHANGE_ME_RUN_openssl_rand_hex_32'
      expect(placeholder.length).toBeGreaterThanOrEqual(32) // 证明长度检查挡不住它

      for (const value of [
        placeholder,
        'REPLACE_ME_with_a_real_secret_value_here',
        'YOUR_SECRET_KEY_GOES_RIGHT_HERE_OK',
        'example_secret_that_is_long_enough_xx',
        'TODO_generate_a_proper_secret_value_x',
      ]) {
        process.env.SESSION_SECRET = value
        const res = await buildApp().request('/protected')
        expect(res.status, `占位值 "${value}" 不应被接受`).toBe(500)
      }
    })

    it('占位值检查大小写不敏感', async () => {
      process.env.SESSION_SECRET = 'change_me_this_is_long_enough_to_pass_32'
      const res = await buildApp().request('/protected')
      expect(res.status).toBe(500)
    })

    it('真随机的 hex secret 被接受（不误伤正常值）', async () => {
      // 32 字节 hex = 64 字符，openssl rand -hex 32 的产物形态
      process.env.SESSION_SECRET = 'a3f8e1c94b7d2065fe8a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708'
      const app = buildApp()
      const login = await app.request('/login', { method: 'POST', body: PASSWORD })
      expect(login.status).toBe(200)
      const res = await app.request('/protected', {
        headers: { cookie: sessionCookieFrom(login) },
      })
      expect(res.status).toBe(200)
    })

    it('SESSION_SECRET 缺失时不签发会话（避免「登录成功却处处 401」）', async () => {
      delete process.env.SESSION_SECRET
      const res = await buildApp().request('/login', { method: 'POST', body: PASSWORD })
      expect(res.status).toBe(500)
      expect(res.headers.get('set-cookie')).toBeNull()
    })

    it('ADMIN_PASSWORD 未设置时任何密码都不通过（含空串）', async () => {
      delete process.env.ADMIN_PASSWORD
      const app = buildApp()
      for (const attempt of ['', 'anything', PASSWORD]) {
        const res = await app.request('/login', { method: 'POST', body: attempt })
        expect(res.status, `密码 "${attempt}" 不应通过`).toBe(401)
      }
    })
  })
})

describe('passwordMatches', () => {
  it('相同字符串为真', () => {
    expect(passwordMatches('abc', 'abc')).toBe(true)
  })

  it('不同内容为假', () => {
    expect(passwordMatches('abc', 'abd')).toBe(false)
  })

  it('长度不同为假（含前缀情形）', () => {
    expect(passwordMatches('abc', 'abcd')).toBe(false)
    expect(passwordMatches('abcd', 'abc')).toBe(false)
  })

  it('expected 为 undefined 时恒假 —— 未配密码不等于任意密码可用', () => {
    expect(passwordMatches('', undefined)).toBe(false)
    expect(passwordMatches('anything', undefined)).toBe(false)
  })

  it('expected 为空串时也恒假 —— 空密码不是有效凭据', () => {
    expect(passwordMatches('', '')).toBe(false)
    expect(passwordMatches('x', '')).toBe(false)
  })

  it('支持多字节字符', () => {
    expect(passwordMatches('密码🔐', '密码🔐')).toBe(true)
    expect(passwordMatches('密码🔐', '密码🔑')).toBe(false)
  })
})
