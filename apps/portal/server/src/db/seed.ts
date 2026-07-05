import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { resolve } from 'path'
import { profile, project } from './schema.js'

const dbPath = resolve(process.env.DB_PATH ?? '../data/portal.db')
const sqlite = new Database(dbPath)
const db = drizzle(sqlite)

// Seed profile
db.insert(profile).values({
  id: 1,
  nameEn: 'Yibin Feng',
  nameZh: '冯一镔',
  bioEn: 'AI Engineer · Researcher · Builder',
  bioZh: 'AI 工程师 · 研究员 · 构建者',
  avatarPath: '/uploads/avatar.jpg',
  github: 'https://github.com/FengYibin66',
  linkedin: 'https://linkedin.com/in/yibinfeng-imperial',
  email: 'fengyibinapply@163.com',
  updatedAt: Math.floor(Date.now() / 1000),
}).onConflictDoNothing().run()

// Seed projects
db.insert(project).values([
  {
    nameEn: 'Resume Site',
    nameZh: '个人简历网站',
    descEn: 'Interactive 3D personal portfolio with particle effects and bilingual support',
    descZh: '带有粒子特效的 3D 交互式个人简历，支持中英双语',
    techTags: JSON.stringify(['Next.js', 'Three.js', 'Tailwind', 'Framer Motion']),
    screenshotPath: null,
    url: 'https://resume.yibinfeng.com',
    status: 'dev',
    order: 0,
    visible: 1,
  },
  {
    nameEn: 'WeChat Platform',
    nameZh: '微信内容自动化平台',
    descEn: 'AI-driven WeChat Official Account automation: one-click from topic to published draft',
    descZh: '基于 AI 的微信公众号自动化平台，一键完成从选题到发布草稿的全流程',
    techTags: JSON.stringify(['Go', 'Vue 3', 'Python', 'FastAPI', 'LangChain']),
    screenshotPath: null,
    url: 'https://yibinfeng.com',
    status: 'live',
    order: 1,
    visible: 1,
  },
]).run()

console.log('Seed complete')
sqlite.close()
