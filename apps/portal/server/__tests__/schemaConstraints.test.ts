import { beforeEach, describe, expect, it } from 'vitest'

import { project } from '../src/db/schema.js'
import { createTestDb, VALID_PROJECT } from './helpers/testDb.js'

/**
 * 这组用例存在的理由：ADR 20260822120808 最初断言「enum 约束落在数据库侧」，
 * 而实测 `text('status', { enum: [...] })` 对 SQLite 生成**零 SQL**
 * （drizzle-kit 输出 "No schema changes, nothing to migrate"）——那个断言是错的。
 *
 * 真正的库侧约束来自 schema 里显式声明的 CHECK。既然论断错过一次，
 * 就必须有用例把它钉住：光有注释拦不住漂移。
 */
describe('project 表的库侧约束', () => {
  let ctx: ReturnType<typeof createTestDb>

  beforeEach(async () => {
    ctx = createTestDb()
    await ctx.applyMigrations()
  })

  it('migration 里确实带 CHECK 约束（而非仅类型层 enum）', async () => {
    const res = await ctx.client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='project'"
    )
    const ddl = String(res.rows[0]?.sql ?? '')

    expect(ddl).toContain('project_status_valid')
    expect(ddl).toContain('project_visible_bool')
    expect(ddl.toUpperCase()).toContain('CHECK')
  })

  it('经 Drizzle 写入合法值成功', async () => {
    const [row] = await ctx.db.insert(project).values(VALID_PROJECT).returning()
    expect(row?.status).toBe('live')
    expect(row?.visible).toBe(1)
  })

  it('裸 SQL 写入非法 status 被库拒绝', async () => {
    // 关键用例：绕过 TypeScript 直接走 SQL。若只有 enum 没有 CHECK，这里会成功插入。
    await expect(
      ctx.client.execute({
        sql: `INSERT INTO project
                (name_en, name_zh, desc_en, desc_zh, tech_tags, url, status, "order", visible)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ['a', 'a', 'a', 'a', '[]', 'https://x.com', 'archived', 0, 1],
      })
    ).rejects.toThrow(/CHECK constraint failed/i)
  })

  it('裸 SQL 写入非法 visible 被库拒绝', async () => {
    await expect(
      ctx.client.execute({
        sql: `INSERT INTO project
                (name_en, name_zh, desc_en, desc_zh, tech_tags, url, status, "order", visible)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ['a', 'a', 'a', 'a', '[]', 'https://x.com', 'live', 0, 7],
      })
    ).rejects.toThrow(/CHECK constraint failed/i)
  })

  it('UPDATE 改成非法值同样被拒绝', async () => {
    const [row] = await ctx.db.insert(project).values(VALID_PROJECT).returning()

    await expect(
      ctx.client.execute({
        sql: 'UPDATE project SET status = ? WHERE id = ?',
        args: ['deleted', row!.id],
      })
    ).rejects.toThrow(/CHECK constraint failed/i)

    // 拒绝后原值不变
    const after = await ctx.client.execute({
      sql: 'SELECT status FROM project WHERE id = ?',
      args: [row!.id],
    })
    expect(after.rows[0]?.status).toBe('live')
  })

  it('status 缺省为 live', async () => {
    await ctx.client.execute({
      sql: `INSERT INTO project
              (name_en, name_zh, desc_en, desc_zh, tech_tags, url, "order", visible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['a', 'a', 'a', 'a', '[]', 'https://x.com', 0, 1],
    })
    const res = await ctx.client.execute('SELECT status FROM project')
    expect(res.rows[0]?.status).toBe('live')
  })
})
