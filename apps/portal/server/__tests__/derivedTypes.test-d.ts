/**
 * 类型层测试：证明 ADR 20260822120808 的派生**真的生效**，而不是退化成 `any`。
 *
 * 这个文件不含运行时断言——它靠 `tsc --noEmit` 通过与否来判定。
 * 每个 `@ts-expect-error` 都是一条断言：**该行必须报错**。若类型退化成 `any`，
 * 那些行就不再报错，TypeScript 会反过来报「未使用的 @ts-expect-error 指令」而失败。
 * 也就是说这些指令是双向的探针，不是抑制器。
 *
 * 纳入 `tsconfig.json` 的 include，因此 `pnpm type-check` 会覆盖它。
 */
import type { Profile, Project, ProjectInsert, ProjectStatus } from '../src/db/types.js'

// ── Project 是真实结构，字段齐全 ──────────────────────────────────
const complete: Project = {
  id: 1,
  nameEn: 'a',
  nameZh: 'a',
  descEn: 'a',
  descZh: 'a',
  techTags: '[]',
  screenshotPath: null,
  url: 'https://example.com',
  status: 'live',
  order: 0,
  visible: 1,
}
void complete

// 多出字段必须报错——若 Project 是 any 就不会报
// @ts-expect-error 不存在的字段
const extraField: Project = { ...complete, nope: 1 }
void extraField

// 缺字段必须报错
// @ts-expect-error 缺少必填字段
const missingFields: Project = { id: 1 }
void missingFields

// 字段类型必须被约束
// @ts-expect-error id 是 number 而非 string
const wrongFieldType: Project = { ...complete, id: 'x' }
void wrongFieldType

// ── status 的 enum 约束从 schema 传导到类型层 ────────────────────
const validStatus: ProjectStatus = 'dev'
void validStatus

// @ts-expect-error 只允许 'live' | 'dev'
const invalidStatus: ProjectStatus = 'archived'
void invalidStatus

// @ts-expect-error 同样约束整行对象里的 status
const invalidStatusInRow: Project = { ...complete, status: 'archived' }
void invalidStatusInRow

// ── screenshotPath 可空（schema 里未 notNull） ──────────────────
const nullableOk: Project = { ...complete, screenshotPath: null }
void nullableOk
const stringOk: Project = { ...complete, screenshotPath: '/x.png' }
void stringOk

// ── Insert 类型允许省略有默认值的字段 ───────────────────────────
const minimalInsert: ProjectInsert = {
  nameEn: 'a',
  nameZh: 'a',
  descEn: 'a',
  descZh: 'a',
  url: 'https://example.com',
  // techTags / status / order / visible / id 都有默认值，可省
}
void minimalInsert

// @ts-expect-error 无默认值的 nameEn 不可省
const insertMissingRequired: ProjectInsert = { nameZh: 'a', descEn: 'a', descZh: 'a', url: 'u' }
void insertMissingRequired

// ── Profile 同样是真实结构 ─────────────────────────────────────
// @ts-expect-error 缺字段
const badProfile: Profile = { id: 1 }
void badProfile
