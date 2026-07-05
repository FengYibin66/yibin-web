import { defineConfig } from 'drizzle-kit'
import { resolve } from 'path'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${resolve(process.env.DB_PATH ?? '../data/portal.db')}`,
  },
})
