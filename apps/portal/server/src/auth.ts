import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const SESSION_COOKIE = 'portal_session'
const SESSION_VALUE = 'authenticated'

export function requireAuth(c: Context, next: Next) {
  const session = getCookie(c, SESSION_COOKIE)
  if (session !== SESSION_VALUE) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
}

export function setSession(c: Context) {
  setCookie(c, SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export function clearSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
