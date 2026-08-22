import { serve } from '@hono/node-server'
import { createApp } from './app.js'

// 本文件只负责起进程。路由装配在 app.ts——分开是为了让路由层可测
// （原先在这里顶层 serve()，任何 import 都会真的占端口）。

const app = createApp()
const port = Number(process.env.PORT ?? 3000)

console.log(`Server running on http://localhost:${port}`)

const server = serve({ fetch: app.fetch, port })

// 优雅退出，让 tsx watch 重启时能干净回收端口
process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
