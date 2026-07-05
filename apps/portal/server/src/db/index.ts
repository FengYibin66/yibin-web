import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { resolve } from 'path'
import * as schema from './schema.js'

const url = `file:${resolve(process.env.DB_PATH ?? '../data/portal.db')}`
const client = createClient({ url })

export const db = drizzle(client, { schema })
export type DB = typeof db
