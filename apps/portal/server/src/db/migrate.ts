import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'path'

const dbPath = resolve(process.env.DB_PATH ?? '../data/portal.db')
const sqlite = new Database(dbPath)
const db = drizzle(sqlite)

migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations complete')
sqlite.close()
