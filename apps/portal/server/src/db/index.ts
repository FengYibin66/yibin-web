import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { resolve } from 'path'
import * as schema from './schema.js'

/**
 * 连接串解析。优先级：
 *   1. DB_URL —— 完整 libSQL URL，测试用 `:memory:`，将来接托管 Turso 也走这里
 *   2. DB_PATH —— 本地文件路径（既有行为，默认 ../data/portal.db）
 *
 * 加 DB_URL 是为了让集成测试能用内存库：原先只认 DB_PATH 且强制拼 `file:`，
 * 测试没法不落盘。默认路径不变，既有部署无需改动。
 */
export function resolveDbUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DB_URL) return env.DB_URL
  return `file:${resolve(env.DB_PATH ?? '../data/portal.db')}`
}

/**
 * 底层连接。导出它是为了让集成测试能在**同一个连接**上建表——
 * libSQL 的 `:memory:` 是每连接一个独立库，另开一个 client 会得到空库
 * （曾因此让 9 个路由用例全部 "no such table: project"）。
 * 业务代码请用下面的 `db`，不要直接用它。
 */
export const client = createClient({ url: resolveDbUrl() })

export const db = drizzle(client, { schema })
export type DB = typeof db
