# Spec: Portal Homepage (www.yibinfeng.com)

**状态**: Ready — Open Questions 全部确认，可以开始实现  
**作者**: Yibin Feng  
**日期**: 2026-07-05  
**关联**: [resume-site.md](./resume-site.md), [platform.md](./platform.md)

---

## 1. Context

`www.yibinfeng.com` 目前没有内容（或指向其他项目）。需要一个统一的个人主页，作为整个 yibinfeng.com 品牌的入口，向招聘方、技术同行和普通公众展示个人身份，并导航到各子项目。

---

## 2. Goals

- 访客在 5 秒内理解"这是谁、做什么的"
- 访客能清晰看到并跳转到各子项目（Resume Site、WeChat Platform）
- 同时服务中英文用户（切换无刷新）
- 页面加载快（首屏 SSR，Lighthouse Performance ≥ 90）

---

## 3. Non-Goals

- 不实现博客或文章系统
- 不实现 Three.js 粒子背景（那是 Resume 的特色，Portal 走简洁路线）
- 不对外开放用户注册（只有作者一个 admin 账号）
- 不实现评论/联系表单（邮件链接足够）

---

## 4. 受众与用途

| 受众 | 他们来这里找什么 |
|------|---------------|
| 招聘方 / HR | 快速了解背景亮点，找到简历链接 |
| 技术同行 | 看项目技术栈，找到 GitHub |
| 普通公众 | 知道这个人是谁，有什么作品 |

---

## 5. 页面结构（单页，无子路由）

### Navbar（固定顶部）
- 左侧：站点名 `Yibin Feng`（点击平滑滚动回顶部）
- 右侧：语言切换按钮（`EN` / `中文`）、主题切换图标（`☀️` / `🌙`）、`Admin` 文字链接
- 滚动时背景加半透明模糊（`backdrop-blur`），未滚动时透明
- 主题切换和语言切换持久化到 localStorage

### Section 1 — Hero
- 头像（圆形裁剪）
- 姓名：`Yibin Feng / 冯一镔`
- 一句话定位（静态文字）
  - EN: *"AI Engineer · Researcher · Builder"*
  - ZH: *"AI 工程师 · 研究员 · 构建者"*
- 三个快速链接 icon：GitHub、LinkedIn、Email
- **下滑引导**（Hero 底部居中）：
  - 文字：`See My Projects` / `查看我的项目`
  - 两个 `ChevronDown` 箭头叠放，第二个延迟 0.3s，交替呼吸淡入淡出，营造向下流动感
  - 点击后平滑滚动到 Projects 区域
  - 页面滚动超过 60px 后整体淡出隐藏

### Section 2 — Projects
- 标题：`Projects` / `我的项目`
- 2–4 张项目卡片，横向排列（桌面端 2–3 列，移动端 1 列）
- 每张卡片包含：
  - 项目名称
  - 一句话描述
  - 技术栈 tag（最多 4 个）
  - 状态 badge：`Live` / `In Development`
  - 跳转链接按钮
- **整张卡片可点击**，点击跳转到 `project.url`（`target="_blank"`）；底部"访问"按钮保留作视觉提示

**初始项目列表**：

| 项目 | 描述 | 技术 | 链接 |
|------|------|------|------|
| Resume Site | Interactive 3D personal portfolio | Next.js, Three.js, Tailwind | resume.yibinfeng.com |
| WeChat Platform | AI-driven content automation | Go, Vue 3, Python, FastAPI | mpauto.yibinfeng.com |

### Section 3 — Footer
- 版权信息（语言切换、主题切换、Admin 均已移至 Navbar）

---

## 6. 视觉设计系统

继承 Resume 的设计 token，但减少复杂性：

```
暗色主题（默认）:
  背景: #070B12
  卡片: #0D1220
  边框: #1E2740
  主强调: #00D4FF (cyan)
  次强调: #6366F1 (indigo)
  文字: #F0F4FF / #8B9BBC

浅色主题:
  背景: #F8FAFC
  卡片: #FFFFFF
  边框: #E2E8F0
  主强调: #0EA5E9 (sky-500)
  次强调: #6366F1 (indigo)
  文字: #0F172A / #64748B

字体（与 resume 完全一致）:
  标题: Space Grotesk
  正文: Inter
  中文: system-ui (PingFang SC / Microsoft YaHei)
```

动画：
- **无 Three.js 粒子**（Portal 走轻量路线）
- Framer Motion 滚动触发淡入（`opacity 0→1, y 20→0`，简洁）
- 卡片 hover：轻微 border 颜色变化 + 微小 scale（`1.02`）
- 无自定义鼠标指针

---

## 7. 技术方案

### 前端技术栈（已确认）

React 19 + Vite 8 SPA 架构，原因：代码量最少、AI 可直接读改组件、Tailwind 原子类自文档，AI 开发场景生成质量最高。

| 层 | 选型 | 理由 |
|---|---|---|
| UI 框架 | **React 19 + TypeScript** | 最新稳定版 |
| 构建工具 | **Vite 8** | 比 Next.js 更轻量，SPA 场景足够 |
| 路由 | **React Router v7**（hash-based）| 部署灵活，无需服务器配置深链接 |
| 样式 | **Tailwind CSS v4** | 与设计 token 一致，AI 友好 |
| 组件库 | **shadcn/ui** | copy-in 模式，组件代码直接在项目里，可读可改 |
| 客户端状态 | **Zustand** | 轻量，语言切换等 UI 状态 |
| 服务端状态 | **TanStack Query** | API 请求缓存和同步 |
| 动画 | **Framer Motion** | 滚动触发动画 |
| 包管理 | **pnpm workspace** | Monorepo 标准 |

### 后端 API 策略：选项 A（已确认）

一个 `apps/portal` 同时包含前端 + Hono API server：

```
apps/portal/
├── client/        # Vite SPA（React 19）
└── server/        # Hono API server（Node.js，读写 SQLite）

部署：一个 Docker 容器，server 同时 serve 静态文件 + API
生产端口：3000（Docker 容器内）
开发端口：server 3001，client Vite 5173（Vite proxy 透传 /api 到 3001）
```

**开发环境说明**（详见 [platform.md](./platform.md) §1–§2）：

- 先执行根目录 `./scripts/env-build.sh development`
- Server env 由脚本生成 **`apps/portal/.env`**（勿手改）
- Server dev：`tsx watch --env-file=../.env` → 读取 `apps/portal/.env`
- Vite：`host: true` + `allowedHosts: ['www.yibinfeng.com', 'localhost']`
- CORS：`CLIENT_ORIGIN=http://www.yibinfeng.com,http://localhost:5173`（在 `config/env.development.example`）

### 数据模型（SQLite via Drizzle ORM）

> 选 Drizzle 而非 Prisma，因为 Drizzle 与 Hono 搭配更原生，类型推导更简洁。

```typescript
// Profile（单行，只有一个）
profile: {
  id: integer (PK, default 1)
  nameEn, nameZh: text
  bioEn, bioZh: text
  avatarPath: text         // /uploads/avatar.jpg
  github, linkedin, email: text
  updatedAt: integer       // Unix timestamp
}

// Project（多行）
project: {
  id: integer (PK, autoincrement)
  nameEn, nameZh: text
  descEn, descZh: text
  techTags: text           // JSON array string
  screenshotPath: text     // /uploads/proj-xxx.jpg
  url: text
  status: text             // "live" | "dev"
  order: integer
  visible: integer         // 0 | 1
}
```

### 路由结构

```
SPA 路由（hash-based，客户端）:
  /#/            → 主页（默认英文）
  /#/zh          → 中文主页
  /#/admin/login → 登录页
  /#/admin       → Dashboard（登录后）

API 路由（Hono server）:
  GET  /api/profile
  PUT  /api/profile
  GET  /api/projects
  POST /api/projects
  PUT  /api/projects/:id
  DEL  /api/projects/:id
  POST /api/uploads         → 返回文件路径
  POST /api/auth/login
  POST /api/auth/logout
```

> **媒体（MVP）**：当前 `avatarPath` / `screenshotPath` 为本地 `/uploads/*`，Nginx `^~ /uploads/` 反代。  
> **待升级**：COS + CDN，见 [portal-media.md](./portal-media.md)。

### 文件结构

```
apps/portal/
├── client/                     # Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx        # 主页（含语言切换）
│   │   │   ├── admin/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Dashboard.tsx
│   │   ├── components/
│   │   │   ├── sections/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Projects.tsx
│   │   │   │   └── Footer.tsx
│   │   │   └── ui/             # shadcn/ui 组件（copy-in）
│   │   ├── lib/
│   │   │   ├── i18n.ts         # 简单 key-value i18n（无需 next-intl）
│   │   │   └── api.ts          # TanStack Query hooks
│   │   ├── store/
│   │   │   └── locale.ts       # Zustand: 当前语言
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
├── server/                     # Hono API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── profile.ts
│   │   │   ├── projects.ts
│   │   │   ├── uploads.ts
│   │   │   └── auth.ts
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema
│   │   │   └── index.ts        # Drizzle client
│   │   └── index.ts            # Hono app，同时 serve client/dist
│   └── tsconfig.json
├── data/                       # SQLite 文件（挂载到宿主机）
│   └── portal.db
├── uploads/                    # 上传的图片（挂载到宿主机）
├── package.json                # 统一的 scripts
└── Dockerfile
```

### 部署

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build   # 构建 client → client/dist

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
# Hono serve: API on /api/*, static files on /*
CMD ["node", "server/dist/index.js"]
```

```
volumes:
  - ./data:/app/data         # SQLite 持久化
  - ./uploads:/app/uploads   # 图片持久化
```

---

## 8. Alternatives Considered

**A. Portal 直接重定向到 Resume**  
被否定：失去了独立品牌入口，未来无法扩展。

**B. 用 JSON 文件 + 静态导出，不做 admin UI**  
被否定：用户明确需要可视化管理后台，每次改内容不能要求手动编辑文件再重新部署。

**C. 用 Supabase / PlanetScale 等云数据库**  
被否定：引入外部依赖，增加复杂度和成本。SQLite 对单用户 CMS 完全够用。

**D. 用 Next.js 14 Server 模式**  
被否定：Next.js 在 AI 开发场景下 boilerplate 多、框架概念多（Server Components、App Router、RSC）；Vite + Hono SPA 架构代码量更少，AI 可直接读改组件，生成质量更高。

**E. 用现有 auto-wechat 的 MySQL 存 portal 数据**  
被否定：两个应用的数据不应该共用数据库，避免耦合。

---

## 9. Open Questions（实现前必须确认）

- [x] **头像图片**：使用 Yibin.jpg（CSCW 2025 展示现场照）
- [x] **Admin 登录方式**：固定密码，存在 `apps/portal/.env`（由 env-build 从 `.env.shared.local` 生成），httpOnly Cookie 会话
- [x] **项目卡片截图**：需要，admin 后台支持上传
- [x] **子项目访问控制**：Portal 本身公开可访问；各子项目各自处理自己的权限（portal 卡片只负责链接过去）

---

## 10. 验收标准

**公开页面**
- [ ] `pnpm dev:portal` 启动（或 `pnpm dev:all`），`http://www.yibinfeng.com` 可正常访问，内容从 SQLite 读取
- [ ] `/#/` 默认展示英文，`/#/zh` 展示中文
- [ ] 语言切换不刷新页面
- [ ] 所有项目卡片整体可点击，跳转到对应项目 URL
- [ ] Hero 底部下滑引导箭头可见，点击后平滑滚动到 Projects，滚动后箭头隐藏
- [ ] Footer 主题切换按钮可切换暗色/浅色，刷新后保持
- [ ] Lighthouse Performance ≥ 90
- [ ] 移动端（375px）布局无溢出

**Admin 后台**
- [ ] `/#/admin` 未登录时重定向到 `/#/admin/login`
- [ ] 正确密码登录后可进入 Dashboard
- [ ] 可修改 Profile（头像、姓名、Bio、联系方式），保存后主页实时反映
- [ ] 可添加/编辑/删除项目卡片（含截图上传），保存后主页实时反映
- [ ] 错误密码登录失败有提示

**部署**
- [ ] Docker 容器构建成功，`docker run -p 3000:3000` 后 `localhost:3000` 可访问
- [ ] SQLite 数据文件挂载到宿主机目录，容器重建后数据不丢失
