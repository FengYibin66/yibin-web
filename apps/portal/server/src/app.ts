import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { resolve } from 'path'
import { authRouter } from './routes/auth.js'
import { profileRouter } from './routes/profile.js'
import { projectsRouter } from './routes/projects.js'
import { uploadsRouter } from './routes/uploads.js'

/**
 * 装配 Hono 应用，**不监听端口**。
 *
 * 与 index.ts 分开是为了可测：原先 index.ts 在模块顶层直接 `serve()`，
 * 任何 import 它的测试都会真的占端口，于是路由层完全无法单测。
 * 现在 index.ts 只做「起进程」，本文件只做「装配」——对应 cmd/ 与 interface/
 * 的职责分离（见 apps/auto-wechat/AGENTS.md 的分层规则）。
 */
export function createApp() {
  const app = new Hono()

  // 测试环境不打请求日志，否则用例输出被淹没
  if (process.env.NODE_ENV !== 'test') {
    app.use(logger())
  }

  const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (allowedOrigins.includes(origin ?? '') ? origin : undefined),
      credentials: true,
    })
  )

  app.route('/api/auth', authRouter)
  app.route('/api/profile', profileRouter)
  app.route('/api/projects', projectsRouter)
  app.route('/api/uploads', uploadsRouter)

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // 上传文件的静态服务。测试环境不挂：serveStatic 会去解析真实目录。
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/uploads/*',
      serveStatic({
        root: resolve(process.env.UPLOADS_DIR ?? '../uploads'),
        rewriteRequestPath: (p) => p.replace('/uploads', ''),
      })
    )
  }

  // 生产环境同进程提供 SPA
  if (process.env.NODE_ENV === 'production') {
    const clientDist = resolve('../client/dist')
    app.use('*', serveStatic({ root: clientDist }))
    app.get('*', async (c) =>
      c.html(
        await import('fs').then((fs) =>
          fs.readFileSync(resolve(clientDist, 'index.html'), 'utf-8')
        )
      )
    )
  }

  return app
}

export type App = ReturnType<typeof createApp>
