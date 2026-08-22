# 20260822132001. 会话改用 HMAC 签名 cookie，修复认证绕过

- 状态：已接受
- 索引：portal 的 `portal_session` cookie 原为固定明文 `authenticated`，任何人手设该 cookie 即获完整管理员权限；改为 Hono 签名 cookie（值为签发时间戳）+ 服务端独立判过期 + secret 缺失时 fail-closed
- 日期：2026-08-22

## 背景

审查 portal 认证时发现**可远程利用的认证绕过**。修复前的实现：

```ts
const SESSION_VALUE = 'authenticated'

export function requireAuth(c: Context, next: Next) {
  const session = getCookie(c, SESSION_COOKIE)
  if (session !== SESSION_VALUE) return c.json({ error: 'Unauthorized' }, 401)
  return next()
}
```

登录校验 `ADMIN_PASSWORD` 无误，但登录成功后写下的凭据是**固定明文字符串**，且校验只是与同一字符串比较。因此：

在浏览器控制台执行 `document.cookie = 'portal_session=authenticated'`，即获得全部管理员能力——增删改项目、改档案、上传文件。**密码形同虚设**，因为凭据不含任何无法伪造的部分。

影响范围是线上 `www.yibinfeng.com` 的管理后台。受影响端点：`POST/PUT/DELETE /api/projects`、`PUT /api/profile`、`/api/uploads/*`、`GET /api/projects/all`（含未上架内容）。

补充问题：密码比较用 `!==`，非常量时间。

## 选项

- **A. 随机 session id + 服务端会话表**：最标准，可主动吊销；但要建表、要清理过期记录，为单管理员站点引入持久化会话状态。
- **B. HMAC 签名 cookie（无状态）**：凭据 = 载荷 + 签名，伪造需要 secret。无需存储。代价是不能主动吊销单个会话（只能换 secret 全体失效）。
- **C. JWT**：本质同 B，但引入库与算法选择面（`alg: none`、算法混淆等历史坑），载荷能力远超所需。
- **D. 继续明文但加长随机常量**：把 `'authenticated'` 换成一个长随机串。**这是伪修复**——凭据仍是固定值，一旦泄露（日志、截图、浏览器扩展、共享设备）即永久有效，且无法按会话过期。

## 决策

选 **B**，用 Hono 内置的 `setSignedCookie` / `getSignedCookie`（HMAC，验签失败返回 `false`）。

具体：

1. **cookie 值是签发时间戳**，签名覆盖它。服务端取出后**独立判过期**（不依赖浏览器是否遵守 `maxAge`），有效期 7 天。
2. **拒绝签发时刻在未来**的 cookie（容许 60s 时钟偏差），避免时钟异常或构造未来时间戳延长有效期。
3. **`SESSION_SECRET` 缺失或短于 32 字符时 fail-closed**：`requireAuth` 一律返回 500 并在日志说明原因，而不是回退到任何"宽松模式"。判定原则同 ADR 20260822120809——**守卫不可用时必须拒绝，不能放行**。
4. **登录时若 secret 不可用则不签发会话**，直接返回 500。否则会签出一张 `requireAuth` 必然拒绝的 cookie，故障表现为"登录成功却处处 401"，把排查引向错误方向。
5. 密码比较改为常量时间（先比长度再逐字节异或累积，不提前 return）。`ADMIN_PASSWORD` 未设置时恒判否——**"没配密码"不能变成"任意密码都能进"**。

不选 A：单管理员、无多设备管理需求，主动吊销的价值不足以换取会话表的持久化成本。**升级触发条件**：出现多用户或需要"踢下线"能力时，改用 A。

不选 D 是重点：它看起来修好了（值不再是可猜的单词），实际只把"人人可伪造"降级为"泄露即永久失效不了"。凭据必须包含**验证方持有而伪造方不持有**的部分，这是签名的意义。

## 影响

- 正面：伪造需要 `SESSION_SECRET`；会话有服务端强制的有效期；配置缺失时表现为明确的 500 而非静默放行。
- 负面：**新增必需环境变量 `SESSION_SECRET`**。未配置时后台完全不可用（这是刻意的 fail-closed）。已加入 `config/env.shared.example` 并在 `DEPLOYMENT.md` 说明生成方式。
- 负面：换 secret 会让所有现存会话失效（需重新登录）。单管理员场景可接受。
- 影响面：`apps/portal/server/src/auth.ts`、`src/routes/auth.ts`、`config/env.shared.example`、`DEPLOYMENT.md`。

## 验证

`apps/portal/server/__tests__/auth.test.ts` 覆盖攻击面与正常流程，并做了**双向变异测试**确认用例是真防线：

| 变异 | 结果 |
|------|------|
| 验签换成读明文 cookie | 4 个用例失败，含「拒绝无签名的任意值 cookie」 |
| 完全复刻修复前逻辑（比较字面量 `'authenticated'`） | 4 个用例失败，含「拒绝手工构造的固定值 cookie」 |

第二条尤其重要：它证明那条回归用例真的钉住了历史漏洞，而不是恰好因别的原因通过。
