import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setSession, clearSession, requireAuth } from '../auth.js'

export const authRouter = new Hono()

authRouter.post(
  '/login',
  zValidator('json', z.object({ password: z.string() })),
  (c) => {
    const { password } = c.req.valid('json')
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || password !== adminPassword) {
      return c.json({ error: 'Invalid password' }, 401)
    }

    setSession(c)
    return c.json({ ok: true })
  }
)

authRouter.post('/logout', requireAuth, (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

authRouter.get('/me', requireAuth, (c) => {
  return c.json({ authenticated: true })
})
