import type { Context, Next } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'

const SESSION_COOKIE = 'portal_session'

/** 会话有效期。签名里带签发时刻，服务端据此判过期——不依赖浏览器是否遵守 maxAge。 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

// ─────────────────────────────────────────────────────────────────────────────
// 会话 cookie 必须是**签名**的。
//
// 修复前的实现是 `setCookie(c, 'portal_session', 'authenticated')` + 比较字面量
// `'authenticated'`——值固定、无签名，任何人在浏览器里手动设这个 cookie 就获得
// 完整管理员权限（增删项目、改档案、上传文件），登录密码形同虚设。
//
// 现在 cookie 值是「签发时间戳 + HMAC 签名」。伪造需要 SESSION_SECRET，
// 且服务端独立校验签发时刻，过期即拒。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 未被替换的占位值标记。
 *
 * 只靠长度下限是不够的：`config/env.shared.example` 里的占位值
 * `CHANGE_ME_RUN_openssl_rand_hex_32` 恰好 33 字符，**能通过 ≥32 的检查**。
 * 一旦运维没填真值又忽略了 `env-build.sh --check` 的非零退出码，
 * 生产就会用一个**任何读过本仓库的人都知道的 HMAC key** 运行——
 * 本次修复的认证绕过会原样复活。
 *
 * 所以除长度外，还必须拒绝一切带占位标记的值。
 */
const PLACEHOLDER_MARKERS = ['CHANGE_ME', 'REPLACE_ME', 'YOUR_', 'EXAMPLE', 'TODO']

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET
  // 长度下限防止用 'x' 之类的短占位值把签名削弱成没有
  if (!secret || secret.length < 32) return null
  // 长度够但仍是占位值的，同样不可接受（见上）
  const upper = secret.toUpperCase()
  if (PLACEHOLDER_MARKERS.some((marker) => upper.includes(marker))) return null
  return secret
}

/**
 * 会话 secret 是否可用。供登录路由在**比较密码之前**先判配置，
 * 避免 401/500 的差异变成密码正确性 oracle（见 routes/auth.ts 的说明）。
 */
export function sessionSecretUsable(): boolean {
  return sessionSecret() !== null
}

/** secret 缺失或过弱时的统一处理：拒绝，并说清原因。fail-closed。 */
function secretMisconfigured(c: Context) {
  console.error(
    '[auth] SESSION_SECRET 未设置、短于 32 字符，或仍是未替换的占位值' +
      `（含 ${PLACEHOLDER_MARKERS.join(' / ')} 之一）——所有认证请求将被拒绝。` +
      '生成：openssl rand -hex 32'
  )
  return c.json({ error: 'Server auth misconfigured' }, 500)
}

export async function requireAuth(c: Context, next: Next) {
  const secret = sessionSecret()
  if (!secret) return secretMisconfigured(c)

  // 验签失败时 hono 返回 false；cookie 不存在时返回 undefined。两者都不放行。
  const issuedAt = await getSignedCookie(c, secret, SESSION_COOKIE)
  if (typeof issuedAt !== 'string' || issuedAt.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const issuedAtMs = Number(issuedAt)
  if (!Number.isFinite(issuedAtMs)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // 服务端判过期：不信任客户端是否清掉了 cookie。
  // 同时拒绝签发时刻在未来的（时钟回拨或伪造），容许 60s 时钟偏差。
  const ageSeconds = (Date.now() - issuedAtMs) / 1000
  if (ageSeconds > SESSION_MAX_AGE_SECONDS || ageSeconds < -60) {
    return c.json({ error: 'Session expired' }, 401)
  }

  return next()
}

export async function setSession(c: Context): Promise<boolean> {
  const secret = sessionSecret()
  if (!secret) return false

  await setSignedCookie(c, SESSION_COOKIE, String(Date.now()), secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
  return true
}

export function clearSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

/**
 * 密码比较用常量时间，避免按字符提前返回泄露前缀信息。
 *
 * 单管理员站点的实际风险不高，但这是一处零成本的正确做法：
 * 先比长度再逐字节异或累积，不提前 return。
 */
export function passwordMatches(provided: string, expected: string | undefined): boolean {
  if (!expected) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // 长度不同直接判负，但仍走一次固定开销的比较，避免用耗时区分「长度错」与「内容错」
  const sameLength = a.length === b.length
  const width = Math.max(a.length, b.length, 1)
  let diff = sameLength ? 0 : 1
  for (let i = 0; i < width; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

export const AUTH_INTERNALS = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} as const
