import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
  // enum 约束落在 schema 侧而非只在客户端声明（ADR 20260822120808）：
  // 只在消费端存在的约束等于不存在——任何直接写库的路径都能绕过它。
  status: text('status', { enum: ['live', 'dev'] }).notNull().default('live'),
  order: integer('order').notNull().default(0),
  visible: integer('visible').notNull().default(1), // 0 | 1
})
