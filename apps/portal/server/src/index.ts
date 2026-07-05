import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { resolve } from 'path'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { projectsRouter } from './routes/projects.js'
import { uploadsRouter } from './routes/uploads.js'

const app = new Hono()

app.use(logger())
app.use(
  '/api/*',
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
)

// API routes
app.route('/api/auth', authRouter)
app.route('/api/profile', profileRouter)
app.route('/api/projects', projectsRouter)
app.route('/api/uploads', uploadsRouter)

// Serve uploaded files
app.use(
  '/uploads/*',
  serveStatic({ root: resolve(process.env.UPLOADS_DIR ?? '../uploads'), rewriteRequestPath: (p) => p.replace('/uploads', '') })
)

// Serve SPA in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = resolve('../client/dist')
  app.use('*', serveStatic({ root: clientDist }))
  app.get('*', async (c) => {
    return c.html(await import('fs').then((fs) => fs.readFileSync(resolve(clientDist, 'index.html'), 'utf-8')))
  })
}

const port = Number(process.env.PORT ?? 3000)
console.log(`Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
