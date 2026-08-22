# apps/portal/

主站 `www.yibinfeng.com` + 内容管理后台。React 19 (Vite) 前端 + Hono 后端 + libSQL 持久层。

> ## ⚠️ 当前实现不是目标架构，不要以本目录为范例
>
> `server/` 目前是 `routes/` 直接调 `db/`：业务逻辑写在 handler 里，没有领域层，没有用例层，**0 个测试**（`server/package.json` 连 `test` 和 `lint` script 都没有）。
>
> **`client` 的 `lint` script 是空声明**：写着 `eslint src`，但 portal 既无 eslint 依赖也无配置文件，跑它必然 `command not found`。CI 刻意不执行这一步（见 `.github/workflows/ci.yml` 的 portal job 注释）。要补 lint 就先补依赖 + config 再加回 CI，**不要只加依赖不加配置**。
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

约束应加在**数据库侧**（如 `status` 用 Drizzle 的 `text({ enum: [...] })`），而不是让客户端单方面声明一个数据库不保证的联合类型。只在消费端存在的约束等于不存在。

## 命令

```bash
pnpm dev:portal                        # 从仓库根起（client + server）
cd apps/portal/client && pnpm build    # tsc -b && vite build
cd apps/portal/server && pnpm db:migrate
```
