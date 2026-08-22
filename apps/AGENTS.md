# apps/

三个可独立部署的应用。约定与硬约束见根 `CLAUDE.md`。

| 目录 | 应用 | 分层成熟度 |
|------|------|-----------|
| `portal/` | 主站 + 后台（React + Hono + libSQL） | **低** — `routes/` 直连 `db/`，无领域层、0 测试。不要以它为范例 |
| `resume/` | 作品集（Next.js SSG + R3F） | 中 — 31 个测试；但 `lab` 概念散落 `components/` 与 `lib/` 两处 |
| `auto-wechat/` | 微信 AI 平台（Go + Vue + Python） | **高** — `cmd/` + `internal/{domain,application,infrastructure,interface}`，本仓库分层的正确先例 |

## 应用间的硬边界

**三个应用不共享代码，也不共享持久层。**

- portal 用 libSQL 单文件；auto-wechat 用 MySQL + Redis。**两者之间没有共享数据库**（ADR 20260822120802）
- 跨应用的数据需求走 HTTP 接口，不走数据库直连
- **没有 `packages/` 共享层。** 它从未被 git 跟踪（`git ls-files` 无任何 `packages/` 条目），也不在 `pnpm-workspace.yaml` 的 `packages:` 列表里——只是某次留在本地工作副本的空目录。本地看到它就是残留，`rmdir packages` 删掉
- **若你认为需要共享代码，先写 ADR 说明为什么不能各自持有一份**——两个应用各持一份重复代码，通常比一个双方都不敢改的共享包更健康

## 新增后端代码时

按 `auto-wechat/backend/internal/` 的分层组织：`domain`（业务核心，不感知 HTTP 与数据库）/ `application`（用例编排）/ `infrastructure`（外部依赖实现）/ `interface`（传输层适配）。依赖方向单向朝内。

portal 尚未对齐这个结构，是待改造的一方。
