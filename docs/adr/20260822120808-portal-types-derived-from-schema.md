# 20260822120808. Portal 接口类型从 Drizzle schema 派生，不手写

- 状态：已接受
- 索引：portal 的 `Profile` / `Project` 类型由 `schema.ts` 经 Drizzle `$inferSelect` 派生并置于共享位置，前后端同源；不引入 OpenAPI codegen（规模不匹配）。注记：本文初稿称「enum 约束落在数据库侧」，**该说法已被本文「勘误」一节推翻**——SQLite 的 `text({enum})` 只是类型层约束，真正的库侧约束由后补的 CHECK 提供
- 日期：2026-08-22

## 背景

portal 的接口类型目前在两处独立定义，内容重复：

```ts
// apps/portal/server/src/db/schema.ts — 真相
export const project = sqliteTable('project', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  techTags: text('tech_tags').notNull().default('[]'),
  status: text('status').notNull().default('live'),
  visible: integer('visible').notNull().default(1),
  ...
})

// apps/portal/client/src/lib/api.ts — 手抄的副本
export interface Project {
  id: number
  nameEn: string
  techTags: string        // JSON string
  status: 'live' | 'dev'
  visible: number
  ...
}
```

两份定义没有任何机制保证一致。**给 schema 加一个字段，客户端类型不会报错——它只会静默地少一个字段**，直到运行时才发现。这是典型的漂移源，且是最难察觉的一种：类型系统在此处给出虚假的安全感。

注意 `status` 一处已经出现事实分歧：schema 是 `text` 无约束（任何字符串都能入库），客户端声明为 `'live' | 'dev'` 联合类型。客户端比数据库更严格——这个约束在数据库侧不存在，任何直接写库的路径都能破坏它。

## 选项

- **A. 保持手写，靠纪律同步**：零成本；但已经在漂移，且纪律对 AI 不可靠。
- **B. 引入 OpenAPI 契约 + codegen**（EpicGlobal 的做法）：最规范，五端同源；但需要维护 spec 文件、生成脚本、CI 同步校验。portal 目前只有 4 个路由文件、2 个实体、1 个消费端。
- **C. 从 Drizzle schema 用 `$inferSelect` 派生类型，放共享位置**：单一来源是 schema 本身，零额外 spec，改 schema 即刻在客户端产生类型错误。
- **D. 用 tRPC 或 Hono RPC 做端到端类型推导**：类型安全最强；但要求前后端同构部署与构建耦合，且会绑定框架。

## 决策

选 **C**。判定原则：**契约的形式要匹配消费端数量**——一个消费端用类型派生，多语言多端才需要 IDL。

引入 OpenAPI（B）在 portal 当前规模是过度设计：它的收益（跨语言生成、契约先行评审）需要"多个异构消费端"才成立，而 portal 只有一个 React 客户端，同一个 TypeScript 工程内。付 spec 维护成本换不来对应收益。

而 D 会把前后端的构建绑在一起，与 ADR 20260822120801 中「apps 各自独立构建」的现状冲突。

**升级路径要写清楚**（这是本决策的边界）：当 portal 出现**第二个异构消费端**时——例如 resume 站要读 portal 的项目数据、或将来有移动端——本决策应被重新评估，届时 B 的收益才成立。这个触发条件明确写在此处，避免将来靠感觉判断。

顺带修正 `status` 的分歧：约束应在**数据库侧**收紧，而不是让客户端单方面声明一个数据库不保证的约束。约束只在消费端存在，等于没有约束。具体做法见下面的勘误。

## 勘误：`text({ enum })` 不是数据库约束

本文初稿写的是「约束应在数据库侧收紧（Drizzle 的 `text({ enum: [...] })`）」。**这句话是错的**，实测推翻：

```
$ drizzle-kit generate     # 只加了 { enum: ['live','dev'] } 之后
No schema changes, nothing to migrate 😴
```

Drizzle 对 SQLite 的 `text(name, { enum })` **只作用于 TypeScript 类型，生成零 SQL**。它带来的实际收益是：所有经 Drizzle 的读写路径在编译期受约束，且派生类型让客户端自动跟随——这确实比「客户端单方面声明联合类型、服务端类型是裸 `string`」强。但它**拦不住裸 SQL**，所以称它为「数据库侧约束」是错的。

真正的库侧约束用显式 CHECK（drizzle 0.36 的 `check()`，注意该版本 `extraConfig` 回调要求返回**对象**，数组形式是更高版本的 API）：

```ts
}, (table) => ({
  statusValid: check('project_status_valid', sql`${table.status} IN ('live', 'dev')`),
  visibleBool: check('project_visible_bool', sql`${table.visible} IN (0, 1)`),
}))
```

这个确实生成 migration（`0001_add_project_checks.sql`）。SQLite 不支持 `ALTER TABLE ADD CONSTRAINT`，所以 drizzle 生成的是**整表重建**：建新表 → `INSERT...SELECT` 拷数据 → 换名。

**部署注意**：若现有库里存在 `status` 不属于 `('live','dev')` 或 `visible` 不属于 `(0,1)` 的行，拷数据那步会因 CHECK 失败而整个 migration 回滚。这是正确行为（响亮失败胜过静默丢数据），但上线前应先查一遍存量数据。

于是最终是**两层**：`enum` 管编译期（覆盖所有 Drizzle 路径），`CHECK` 管运行期与外部写入。两层都由 `schema.ts` 一处声明。

教训：「约束在哪一层生效」必须实测，不能从 API 长相推断。这个错误能被发现是因为审查时去生成了一次 migration；现在有 `__tests__/schemaConstraints.test.ts` 用裸 SQL 插非法值来钉住它——注释和 ADR 都拦不住漂移，只有可执行的断言能。

## 影响

- 正面：schema 成为唯一来源；加字段/改类型立刻在客户端产生编译错误；消除一处虚假类型安全。
- 负面：客户端类型与数据库行类型耦合——若将来 API 响应形状需要偏离表结构（如聚合、字段裁剪），需要显式定义 DTO 而非继续派生。**这不是缺陷而是正确的信号**：需要 DTO 时就是需要真契约的时候，正好对应上面的升级触发条件。
- 影响面：`apps/portal/server/src/db/schema.ts`（`status` 加 enum 约束）、新增共享类型出口、`apps/portal/client/src/lib/api.ts` 删除手写 interface。
