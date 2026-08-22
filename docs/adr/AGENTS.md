# docs/adr/

架构决策记录（Architecture Decision Record）。制度本身见 [ADR 20260822120805](./20260822120805-adopt-adr-with-forward-pointers.md)，格式与使用约定见 [`TEMPLATE.md`](./TEMPLATE.md)。

## 三条硬规则

1. **ADR 不可变。** 决策变了新写一份，不重写旧文件。
2. **修订旧 ADR 只改两个字段**：`- 状态：` 和 `- 索引：`（在索引末尾追加「注记：X 已被 `<新ID>` 修订…；其余不受影响」）。不加这个前向指针，一份被局部修订的 ADR 会被整体误判为过期或整体误用。
3. **下面的表是生成物。** 改完 ADR 头部字段后运行 `python3 scripts/docs/gen_docs_index.py`，不要手改表体。

## 什么该写 ADR

ADR 记录**有备选方案的选择**。写不出两个真实备选的，不是决策而是事实——写进 `docs/architecture/` 或对应目录的 `AGENTS.md`。

## 索引

<!-- BEGIN:adr-index (生成物，勿手改；见 scripts/docs/gen_docs_index.py) -->

共 10 份。按 ID（创建时间）升序。

| ID | 结论 | 状态 | 索引 |
|----|------|------|------|
| [`20260822120801`](./20260822120801-monorepo-carries-three-sites.md) | Monorepo 承载三站：部署耦合决定仓库边界 | 已接受 | 三站（portal / resume / auto-wechat）同仓，理由是共用一台 CVM、一份 nginx、一条 compose，部署耦合度高于代码耦合度；代价是 CI 需 path-based 过滤（尚未落地，见 20260822120807） |
| [`20260822120802`](./20260822120802-portal-uses-libsql-not-shared-mysql.md) | Portal 用 libSQL 单文件库，不复用 auto-wechat 的 MySQL | 已接受 | portal 的持久层是 libSQL（SQLite 兼容）单文件 + Drizzle ORM，**不是** MySQL；纠正 `docs/ARCHITECTURE.md` 两处「MySQL（shared）」「Portal & Auto-Wechat share MySQL」的错误陈述 |
| [`20260822120803`](./20260822120803-resume-ssg-no-runtime-backend.md) | Resume 用 Next.js SSG 静态导出，不保留运行时后端 | 已接受 | resume 站 `output: export` 纯静态、由 nginx 直接提供，无 Node 运行时；代价是任何动态需求都必须外置成独立接口，不能在 resume 内加 API route |
| [`20260822120804`](./20260822120804-single-cvm-compose-not-k8s.md) | 单台 CVM + Docker Compose 编排，不上 K8s | 已接受 | 生产是一台腾讯云 CVM 上的 docker compose，不引入 K8s / 托管容器服务；判定原则是「没有需要弹性的负载轴就不引入编排平台」 |
| [`20260822120805`](./20260822120805-adopt-adr-with-forward-pointers.md) | 引入 ADR 制度：不可变 + 前向指针 + 生成式索引 | 已接受 | 决策记录用时间戳 ID 的不可变 ADR；被后续修订时只改旧 ADR 的 `状态：`/`索引：` 两个字段追加前向指针；索引表由脚本生成不手改 |
| [`20260822120806`](./20260822120806-layered-agents-md-context.md) | AGENTS.md 分层上下文：就近加载，且必须标注「现状 ≠ 目标」 | 已接受 | 每个有约定的目录放一份 AGENTS.md，操作该目录前先读；根目录不放 AGENTS.md 以 CLAUDE.md 为准；临时实现必须显式标注不可作为目标架构反推依据 |
| [`20260822120807`](./20260822120807-ci-quality-gate-and-manual-prod-promote.md) | CI 质量门禁前置，生产发布改为人工 promote | 已接受 | 新增 `ci.yml` 在 PR 与 push 上跑 lint + test（path-based 过滤）；`deploy.yml` 去掉 `push: main` 自动触发，改为仅 `workflow_dispatch` 人工触发；部署与发布解耦 |
| [`20260822120808`](./20260822120808-portal-types-derived-from-schema.md) | Portal 接口类型从 Drizzle schema 派生，不手写 | 已接受 | portal 的 `Profile` / `Project` 类型由 `schema.ts` 经 Drizzle `$inferSelect` 派生并置于共享位置，前后端同源；不引入 OpenAPI codegen（规模不匹配）。注记：本文初稿称「enum 约束落在数据库侧」，**该说法已被本文「勘误」一节推翻**——SQLite 的 `text({enum})` 只是类型层约束，真正的库侧约束由后补的 CHECK 提供 |
| [`20260822120809`](./20260822120809-preooluse-hooks-as-mechanical-gates.md) | 用 PreToolUse hooks 做机制门禁，且必须 fail-closed | 已接受 | AI 红线用 `.claude/hooks/` 的 PreToolUse 脚本机制拦截而非文档请求；拦截须 `exit 2`，守卫自身异常必须映射为拦截；每条 hook 明确声明覆盖边界，不制造虚假安全感 |
| [`20260822132001`](./20260822132001-signed-session-cookie.md) | 会话改用 HMAC 签名 cookie，修复认证绕过 | 已接受 | portal 的 `portal_session` cookie 原为固定明文 `authenticated`，任何人手设该 cookie 即获完整管理员权限；改为 Hono 签名 cookie（值为签发时间戳）+ 服务端独立判过期 + secret 缺失时 fail-closed |

<!-- END:adr-index -->
