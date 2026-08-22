import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

import * as schema from '../../src/db/schema.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = resolve(HERE, '../../drizzle')

/**
 * 建一个应用了全部 migration 的内存库。
 *
 * 刻意跑真实的 migration SQL 而不是让 drizzle 由 schema 推导建表：
 * 本项目要断言的正是 migration 里的 CHECK 约束是否真的落库（ADR 20260822120808），
 * 若用推导建表就测不到 migration 本身，那这个断言就没有意义了。
 */
export function createTestDb() {
  const client = createClient({ url: ':memory:' })
  const db = drizzle(client, { schema })
  return { client, db, applyMigrations: () => applyMigrations(client) }
}

export async function applyMigrations(client: Client): Promise<string[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // 文件名带序号前缀，字典序即执行序

  if (files.length === 0) {
    throw new Error(`未在 ${MIGRATIONS_DIR} 找到任何 migration——测试基架失效`)
  }

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    // drizzle 用 `--> statement-breakpoint` 分隔语句
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      await client.execute(statement)
    }
  }

  return files
}

/** 一个合法的 project 行，用于在测试里按需覆盖单个字段。 */
export const VALID_PROJECT = {
  nameEn: 'Test Project',
  nameZh: '测试项目',
  descEn: 'desc',
  descZh: '描述',
  techTags: '["ts"]',
  screenshotPath: null,
  url: 'https://example.com',
  status: 'live' as const,
  order: 0,
  visible: 1,
}
