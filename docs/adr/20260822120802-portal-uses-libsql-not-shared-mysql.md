# 20260822120802. Portal 用 libSQL 单文件库，不复用 auto-wechat 的 MySQL

- 状态：已接受
- 索引：portal 的持久层是 libSQL（SQLite 兼容）单文件 + Drizzle ORM，**不是** MySQL；纠正 `docs/ARCHITECTURE.md` 两处「MySQL（shared）」「Portal & Auto-Wechat share MySQL」的错误陈述
- 日期：2026-08-22

> 追认性 ADR。实现早已是 libSQL（`apps/portal/server/src/db/index.ts` 用 `@libsql/client` + `drizzle-orm/libsql`），但架构文档长期写作 MySQL 共享库。本 ADR 追认真实决策并作为纠正文档的依据。

## 背景

`docs/ARCHITECTURE.md` 有两处陈述与实现不符：

- Portal 章节：`Database: MySQL (shared)`
- Shared Infrastructure 章节：`MySQL 8.4 (3306) └── wechat_ai database (portal + auto-wechat)`

实际实现：

```
apps/portal/server/src/db/index.ts:1  import { createClient } from '@libsql/client'
apps/portal/server/src/db/index.ts:2  import { drizzle } from 'drizzle-orm/libsql'
apps/portal/server/src/db/schema.ts:1 import { ... } from 'drizzle-orm/sqlite-core'
```

**这类分歧的代价不是"文档不整洁"，而是基于错误前提的连锁设计**：读到"portal 和 auto-wechat 共享 MySQL"的人（或 AI）会认为跨两者做 join、共用连接池、共用迁移工具是自然的，并据此写代码——而这些在 libSQL 单文件下全部不成立。

## 选项

- **A. 改实现去对齐文档**（portal 迁到共享 MySQL）：让文档变成事实。但要为数十行个人档案数据引入 MySQL 容器、连接池、备份策略。
- **B. 改文档去对齐实现**（追认 libSQL）：承认实现是对的，文档是错的。
- **C. 迁到 Postgres**：功能最全，但同样为极小数据量付整套运维成本。

## 决策

选 **B**。判定原则：**数据规模与写并发决定存储选型；文档与实现分歧时先问哪一侧是对的，不要默认文档正确**。

portal 的数据是个人档案（1 行）+ 项目列表（数十行），单人写、读多写极少。MySQL 能提供的（并发控制、复制、复杂查询）在这个量级一项都用不上，而要付的（容器常驻内存、连接配置、备份脚本、迁移工具链）是实打实的。

更重要的是**边界收益**：libSQL 让 portal 的持久层是一个文件，portal 因此可以完全脱离 MySQL 容器独立启动和独立备份。共享 MySQL 会把 portal 和 auto-wechat 绑成一个可用性单元——auto-wechat 的数据库出问题会带下主站，这对两个本无业务关系的应用是纯负债。

推论：**portal 与 auto-wechat 之间不存在共享持久层，任何跨两者的数据需求都必须走接口，不能走数据库**。这条边界比存储选型本身更重要。

## 影响

- 正面：portal 可独立起停；备份 = 拷一个文件；主站可用性不受 auto-wechat 数据库影响。
- 负面：无法跨 portal / auto-wechat 做 SQL join（本就不该做，见上条推论）；libSQL 的并发写能力有上限——若将来 portal 加入多用户写入场景需重新评估本决策。
- 影响面：`docs/ARCHITECTURE.md` 两处陈述已随本 ADR 同批改正；`apps/portal/server/` 实现不变。
