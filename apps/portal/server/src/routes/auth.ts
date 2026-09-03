import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  setSession,
  clearSession,
  requireAuth,
  passwordMatches,
  sessionSecretUsable,
} from '../auth.js'

export const authRouter = new Hono()

authRouter.post(
  '/login',
  zValidator('json', z.object({ password: z.string() })),
  async (c) => {
    const { password } = c.req.valid('json')

    // 配置检查必须在密码比较**之前**。
    //
    // 反过来（先比密码、错则 401、对则因缺 secret 返回 500）会让登录接口在
    // SESSION_SECRET 配错的整段时间里变成一个**密码正确性 oracle**：
    // 攻击者用 401 与 500 的差异即可离线爆破 ADMIN_PASSWORD，
    // 而常量时间比较对这个维度毫无帮助。
    //
    // 现在无论密码对错，配置有问题就一律 500，不泄露任何密码信息。
    if (!sessionSecretUsable()) {
      return c.json({ error: 'Server auth misconfigured' }, 500)
    }

    // 常量时间比较；ADMIN_PASSWORD 未设置时 passwordMatches 恒为 false，
    // 即「没配密码」不会变成「任意密码都能进」。
    if (!passwordMatches(password, process.env.ADMIN_PASSWORD)) {
      return c.json({ error: 'Invalid password' }, 401)
    }

    const issued = await setSession(c)
    if (!issued) {
      // 上面已查过配置，走到这里说明是签名过程本身失败，仍不能签出
      // 一个 requireAuth 必然拒绝的 cookie（那会表现为「登录成功却处处 401」）。
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
