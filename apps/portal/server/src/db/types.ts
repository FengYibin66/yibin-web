// Portal 接口类型的唯一来源（ADR 20260822120808）。
//
// 类型从 schema.ts 派生，不手写。客户端经 tsconfig 的 `@portal-server/*` 别名
// 以 `import type` 引用本文件——类型导入在编译期擦除，不产生运行时耦合。
//
// 为什么不手写：客户端曾各自声明一份 `interface Project`，与 schema 无任何机制
// 保证一致。给 schema 加字段客户端不会报错，只会静默少一个字段，直到运行时才发现——
// 类型系统在那种写法下给出的是虚假安全感。

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import type { profile, project } from './schema'

/** 档案行（读）。字段与 `profile` 表一一对应。 */
export type Profile = InferSelectModel<typeof profile>

/** 档案写入（有默认值的字段可省）。 */
export type ProfileInsert = InferInsertModel<typeof profile>

/** 项目行（读）。`techTags` 是 JSON 字符串，消费方需自行 parse。 */
export type Project = InferSelectModel<typeof project>

/** 项目写入。 */
export type ProjectInsert = InferInsertModel<typeof project>

/**
 * 项目上架状态。取值由 schema 的 enum 约束保证——约束在数据库侧，
 * 不是只在客户端声明的联合类型（只在消费端存在的约束等于不存在）。
 */
export type ProjectStatus = Project['status']
