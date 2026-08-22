import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey().default(1),
  nameEn: text('name_en').notNull().default('Yibin Feng'),
  nameZh: text('name_zh').notNull().default('冯一镔'),
  bioEn: text('bio_en').notNull().default('AI Engineer · Researcher · Builder'),
  bioZh: text('bio_zh').notNull().default('AI 工程师 · 研究员 · 构建者'),
  avatarPath: text('avatar_path').notNull().default('/uploads/avatar.jpg'),
  github: text('github').notNull().default('https://github.com/FengYibin66'),
  linkedin: text('linkedin').notNull().default('https://linkedin.com/in/yibinfeng-imperial'),
  email: text('email').notNull().default('fengyibinapply@163.com'),
  updatedAt: integer('updated_at').notNull().default(0),
})

export const project = sqliteTable('project', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameEn: text('name_en').notNull(),
  nameZh: text('name_zh').notNull(),
  descEn: text('desc_en').notNull(),
  descZh: text('desc_zh').notNull(),
  techTags: text('tech_tags').notNull().default('[]'), // JSON array string
  screenshotPath: text('screenshot_path'),
  url: text('url').notNull(),
  // `enum` 只是 TypeScript 层约束——实测 drizzle-kit 对它生成零 SQL
  // （"No schema changes, nothing to migrate"）。它让所有走 Drizzle 的路径在
  // 编译期受约束，但拦不住裸 SQL。真正的库侧约束靠下面的 CHECK（ADR 20260822120808）。
  status: text('status', { enum: ['live', 'dev'] }).notNull().default('live'),
  order: integer('order').notNull().default(0),
  visible: integer('visible').notNull().default(1), // 0 | 1
}, (table) => ({
  // 库侧强制：裸 SQL / 外部工具写入非法值也会被拒。
  // 与上面的 enum 是两层——enum 管编译期，CHECK 管运行期与外部写入。
  // drizzle 0.36 的 extraConfig 要求返回对象（数组形式是更高版本的 API）。
  statusValid: check('project_status_valid', sql`${table.status} IN ('live', 'dev')`),
  visibleBool: check('project_visible_bool', sql`${table.visible} IN (0, 1)`),
}))
