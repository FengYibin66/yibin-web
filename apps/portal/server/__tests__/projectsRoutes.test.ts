import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const STRONG_SECRET = 'a'.repeat(48)
const PASSWORD = 'test-password'

// 必须在 import 应用之前设好：src/db/index.ts 在模块加载时就建连接
// （resolveDbUrl 读 env），晚设就来不及了。
process.env.DB_URL = ':memory:'
process.env.SESSION_SECRET = STRONG_SECRET
process.env.ADMIN_PASSWORD = PASSWORD
process.env.NODE_ENV = 'test'

// 动态 import，确保上面的 env 先落地
const { createApp } = await import('../src/app.js')
// 用应用自己的 client：libSQL 的 `:memory:` 是每连接一个独立库，
// 另开一个 client 会拿到空库（曾因此 9 个用例全部 "no such table"）。
const { db, client: raw } = await import('../src/db/index.js')
const { project } = await import('../src/db/schema.js')
const { applyMigrations } = await import('./helpers/testDb.js')

const app = createApp()

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

const VALID_BODY = {
  nameEn: 'Proj',
  nameZh: '项目',
  descEn: 'desc',
  descZh: '描述',
  techTags: ['ts', 'go'],
  screenshotPath: null,
  url: 'https://example.com',
  status: 'live' as const,
  order: 1,
  visible: true,
}

function post(path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('projects 路由', () => {
  beforeAll(async () => {
    await applyMigrations(raw)
  })

  beforeEach(async () => {
    await raw.execute('DELETE FROM project')
  })

  describe('权限边界', () => {
    const writeCases = [
      ['POST', '/api/projects'],
      ['PUT', '/api/projects/1'],
      ['DELETE', '/api/projects/1'],
    ] as const

    it.each(writeCases)('%s %s 未登录时 401', async (method, path) => {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(VALID_BODY),
      })
      expect(res.status).toBe(401)
    })

    it('GET /api/projects/all 未登录时 401（含未上架项目，不能公开）', async () => {
      const res = await app.request('/api/projects/all')
      expect(res.status).toBe(401)
    })

    it('伪造的固定值 cookie 无法通过写接口', async () => {
      const res = await post('/api/projects', VALID_BODY, 'portal_session=authenticated')
      expect(res.status).toBe(401)
    })

    it('GET /api/projects 是公开的', async () => {
      const res = await app.request('/api/projects')
      expect(res.status).toBe(200)
    })
  })

  describe('可见性过滤', () => {
    beforeEach(async () => {
      await db.insert(project).values([
        { ...VALID_BODY, techTags: '[]', visible: 1, order: 1, nameEn: 'shown' },
        { ...VALID_BODY, techTags: '[]', visible: 0, order: 2, nameEn: 'hidden' },
      ])
    })

    it('公开列表只返回 visible=1 的项目', async () => {
      const res = await app.request('/api/projects')
      const rows = (await res.json()) as Array<{ nameEn: string }>
      expect(rows.map((r) => r.nameEn)).toEqual(['shown'])
    })

    it('登录后 /all 返回全部项目', async () => {
      const res = await app.request('/api/projects/all', {
        headers: { cookie: await login() },
      })
      const rows = (await res.json()) as Array<{ nameEn: string }>
      expect(rows.map((r) => r.nameEn).sort()).toEqual(['hidden', 'shown'])
    })
  })

  describe('排序', () => {
    it('按 order 升序返回', async () => {
      await db.insert(project).values([
        { ...VALID_BODY, techTags: '[]', visible: 1, order: 3, nameEn: 'c' },
        { ...VALID_BODY, techTags: '[]', visible: 1, order: 1, nameEn: 'a' },
        { ...VALID_BODY, techTags: '[]', visible: 1, order: 2, nameEn: 'b' },
      ])
      const rows = (await (await app.request('/api/projects')).json()) as Array<{
        nameEn: string
      }>
      expect(rows.map((r) => r.nameEn)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('写入与校验', () => {
    it('创建成功返回 201 且 techTags 序列化为 JSON 字符串', async () => {
      const res = await post('/api/projects', VALID_BODY, await login())
      expect(res.status).toBe(201)
      const row = (await res.json()) as { techTags: string; visible: number; id: number }
      // techTags 在库里是 JSON 字符串（schema 注释如此），消费方自行 parse
      expect(JSON.parse(row.techTags)).toEqual(['ts', 'go'])
      // API 收 boolean，库存 0/1
      expect(row.visible).toBe(1)
    })

    it('visible=false 落库为 0', async () => {
      const res = await post('/api/projects', { ...VALID_BODY, visible: false }, await login())
      const row = (await res.json()) as { visible: number }
      expect(row.visible).toBe(0)
    })

    it('非法 status 被 zod 拦在 400（不落到库的 CHECK）', async () => {
      const res = await post(
        '/api/projects',
        { ...VALID_BODY, status: 'archived' },
        await login()
      )
      expect(res.status).toBe(400)
    })

    it('非法 url 被拦在 400', async () => {
      const res = await post('/api/projects', { ...VALID_BODY, url: 'not-a-url' }, await login())
      expect(res.status).toBe(400)
    })

    it('缺必填字段被拦在 400', async () => {
      const { nameEn: _omit, ...withoutName } = VALID_BODY
      const res = await post('/api/projects', withoutName, await login())
      expect(res.status).toBe(400)
    })

    it('PUT 不存在的 id 返回 404', async () => {
      const res = await app.request('/api/projects/99999', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: await login() },
        body: JSON.stringify(VALID_BODY),
      })
      expect(res.status).toBe(404)
    })

    it('PUT 存在的 id 更新成功', async () => {
      const cookie = await login()
      const created = (await (await post('/api/projects', VALID_BODY, cookie)).json()) as {
        id: number
      }

      const res = await app.request(`/api/projects/${created.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ ...VALID_BODY, nameEn: 'Renamed' }),
      })
      expect(res.status).toBe(200)
      expect((await res.json() as { nameEn: string }).nameEn).toBe('Renamed')
    })

    it('DELETE 后公开列表不再包含它', async () => {
      const cookie = await login()
      const created = (await (await post('/api/projects', VALID_BODY, cookie)).json()) as {
        id: number
      }

      const del = await app.request(`/api/projects/${created.id}`, {
        method: 'DELETE',
        headers: { cookie },
      })
      expect(del.status).toBe(200)

      const rows = (await (await app.request('/api/projects')).json()) as unknown[]
      expect(rows).toHaveLength(0)
    })
  })

  describe('health', () => {
    it('/health 与 /api/health 均返回 ok', async () => {
      for (const path of ['/health', '/api/health']) {
        const res = await app.request(path)
        expect(res.status, path).toBe(200)
        expect(await res.json()).toEqual({ status: 'ok' })
      }
    })
  })
})
