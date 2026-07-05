import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { resolve } from 'path'

const url = `file:${resolve(process.env.DB_PATH ?? '../data/portal.db')}`
const client = createClient({ url })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations complete')
await client.close()
