import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setSession, clearSession, requireAuth, passwordMatches } from '../auth.js'

export const authRouter = new Hono()

authRouter.post(
  '/login',
  zValidator('json', z.object({ password: z.string() })),
  async (c) => {
    const { password } = c.req.valid('json')

    // 常量时间比较；ADMIN_PASSWORD 未设置时 passwordMatches 恒为 false，
    // 即「没配密码」不会变成「任意密码都能进」。
    if (!passwordMatches(password, process.env.ADMIN_PASSWORD)) {
      return c.json({ error: 'Invalid password' }, 401)
    }

    // 密码对但 SESSION_SECRET 缺失/过弱时不能签发会话——
    // 否则会签出一个 requireAuth 一定拒绝的 cookie，表现为「登录成功却处处 401」。
    // 这里直接报配置错误，把故障指向真正的原因。
    const issued = await setSession(c)
    if (!issued) {
      return c.json({ error: 'Server auth misconfigured' }, 500)
    }

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
