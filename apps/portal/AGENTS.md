# apps/portal/

主站 `www.yibinfeng.com` + 内容管理后台。React 19 (Vite) 前端 + Hono 后端 + libSQL 持久层。

> ## ⚠️ 当前实现不是目标架构，不要以本目录为范例
>
> `server/` 目前是 `routes/` 直接调 `db/`：业务逻辑写在 handler 里，**没有领域层，没有用例层**。
>
> 已改善的部分：`server` 现在有 46 个测试（`__tests__/`），`index.ts` 只负责起进程、装配抽到了 `app.ts`（否则路由层无法测——原先顶层就 `serve()`，任何 import 都会真占端口）。**分层本身仍未做**。
>
> **`client` 的 `lint` script 是空声明**：写着 `eslint src`，但 portal 既无 eslint 依赖也无配置文件，跑它必然 `command not found`。CI 刻意不执行这一步（见 `.github/workflows/ci.yml` 的 portal job 注释）。要补 lint 就先补依赖 + config 再加回 CI，**不要只加依赖不加配置**。
>
> `client` 侧仍是 **0 测试**。
>
> **这是已登记的负债，不是等你顺手修复的缺陷**（见根 `CLAUDE.md`「已知负债」）。改动纪律：
>
> - **维护性改动**（改文案、加字段、修 bug）照现状结构来即可，不必先重构分层
> - **新增有业务规则的功能**时，按 `apps/auto-wechat/backend/internal/` 的分层建 domain / application 层，不要继续往 handler 里堆逻辑
> - **不要把本目录的模式扩散到别处**——它是仓库里分层最弱的一处
> - 系统性改造 portal 分层前**先写 ADR**（当前尚无）
>
> 目标分层的正确先例在 `apps/auto-wechat/backend/`，不在这里。

## 结构

```
client/                  # React SPA（Vite）
├── src/pages/           # 页面
├── src/components/
├── src/store/
└── src/lib/
    ├── api.ts           # 请求层 + React Query hooks
    └── i18n.ts
server/                  # Hono API
└── src/
    ├── index.ts         # 入口 + 中间件装配
    ├── auth.ts          # 认证
    ├── routes/          # 路由 + handler（业务逻辑目前也在这里）
    └── db/
        ├── schema.ts    # Drizzle schema — **接口类型的唯一来源**
        ├── index.ts     # libSQL client
        ├── migrate.ts
        └── seed.ts
```

## 持久层：libSQL，不是 MySQL

`db/index.ts` 用 `@libsql/client` + `drizzle-orm/libsql`，schema 用 `drizzle-orm/sqlite-core`。**这是 SQLite 兼容的单文件库，与 auto-wechat 的 MySQL 无任何关系**（ADR 20260822120802）。

历史教训：`docs/ARCHITECTURE.md` 曾长期写作「Portal & Auto-Wechat share MySQL」，与实现不符。任何"跨 portal 和 auto-wechat 做 join / 共用连接池 / 共用迁移工具"的想法都建立在这个错误前提上，一律不成立。

## 接口类型：从 schema 派生，禁止手写

类型的唯一来源是 `server/src/db/schema.ts`。客户端类型经 Drizzle 的 `$inferSelect` 派生（ADR 20260822120808）。

**不要在 `client/src/lib/api.ts` 里手写 `interface Profile` / `interface Project`。** 曾经手写过，与 schema 各自演化——给 schema 加字段客户端不会报错，只会静默少一个字段，直到运行时才发现。类型系统在那种写法下给的是虚假安全感。

## 约束分两层，别把类型层当库层

`status` / `visible` 各有两道约束，声明都在 `schema.ts`：

| 层 | 手段 | 覆盖 | 不覆盖 |
|----|------|------|--------|
| 编译期 | `text('status', { enum: [...] })` | 所有经 Drizzle 的读写；派生类型让客户端自动跟随 | 裸 SQL、外部工具 |
| 运行期 | `check(...)`（生成真实 CHECK 约束） | 任何写入路径，含裸 SQL | — |

**踩过的坑**：`text({ enum })` 看起来像库侧约束，实测 `drizzle-kit generate` 对它输出 `No schema changes, nothing to migrate`——**它生成零 SQL，纯类型层**。ADR 20260822120808 初稿因此写错了一句，已勘误。真正的库侧约束是后补的 `check()`。

结论：**「约束在哪一层生效」必须实测，不能从 API 长相推断。** `__tests__/schemaConstraints.test.ts` 用裸 SQL 插非法值把这件事钉住了——注释拦不住漂移，可执行的断言才行。

改 CHECK 时注意 SQLite 不支持 `ALTER TABLE ADD CONSTRAINT`，drizzle 生成的是整表重建；**若存量数据里有非法值，拷数据那步会失败并回滚整个 migration**，上线前先查存量。

## 认证：会话 cookie 必须是签名的

`SESSION_SECRET`（≥32 字符）是**必需**环境变量。未设置或过短时，会话签发与校验一律拒绝并返回 500——刻意 fail-closed，管理后台会完全不可用（ADR 20260822132001）。生成：`openssl rand -hex 32`。

**历史漏洞**：修复前 cookie 值是固定明文 `authenticated`，`requireAuth` 只与该字面量比较。浏览器控制台一行 `document.cookie = 'portal_session=authenticated'` 即获完整管理员权限——密码形同虚设。现在值是签发时间戳 + HMAC 签名，且服务端独立判过期。

**改动认证代码时**：`__tests__/auth.test.ts` 有伪造、篡改、换 secret、过期、时钟回拨等攻击用例。改完不只要跑通，**还要做变异测试**——把验签换成读明文 cookie，确认用例真的会红。安全测试对着有漏洞的代码也通过的话，它就是零价值的。

## 测试

```bash
pnpm --filter @yibin/portal-server test        # 46 个：认证 / 路由权限 / 库约束
pnpm --filter @yibin/portal-server type-check  # 含 derivedTypes.test-d.ts 的类型层断言
```

三点约定：

- **集成测试用 `DB_URL=:memory:`，并且必须复用 `src/db/index.ts` 导出的 `client`。** libSQL 的 `:memory:` 是**每连接一个独立库**——另开一个 client 会拿到空库，症状是全部用例 `no such table`（踩过）。
- **测试基架跑真实的 migration SQL**（`__tests__/helpers/testDb.ts`），不用 schema 推导建表。因为要断言的正是 migration 里的 CHECK 约束是否落库，推导建表就绕过了被测对象。
- **认证/权限必须有攻击用例**，且经变异测试验证。

## 命令

```bash
pnpm dev:portal                        # 从仓库根起（client + server）
cd apps/portal/client && pnpm build    # tsc -b && vite build
cd apps/portal/server && pnpm db:migrate
cd apps/portal/server && pnpm exec drizzle-kit generate --name <描述>  # 改 schema 后生成 migration
```
