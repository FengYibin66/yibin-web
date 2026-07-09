# Spec: Resume Site (resume.yibinfeng.com)

**状态**: In Progress — 交互升级 + Gallery 页面开发中  
**作者**: Yibin Feng  
**日期**: 2026-07-06（最后更新 2026-07-07）  
**关联**: [portal-homepage.md](./portal-homepage.md), [platform.md](./platform.md), [lab-corridor-complete-spec.md](./lab-corridor-complete-spec.md)  
**调研来源**: docs/research/resume-portfolio-tech-research.md, docs/research/interactive-effects-upgrade.md

---

## 变更历史

### v2.0 — 交互升级（2026-07-07）

**新增功能**：
- Magnetic Button：`GlowButton` 鼠标吸引 + elastic 弹回（桌面端）
- Blur Text Reveal：所有 SectionTitle 从模糊清晰入场
- Scroll Velocity Skew：Project Cards 快速滚动时 skewY 倾斜
- Terminal Hover：Skills badges hover 时字符 shuffle
- 教育院校 Logo：About section 教育卡片显示机构 Logo（raw.githubusercontent.com）
- McAllistern 工地照：Experience 时间线 McAllistern 条目显示 3 张工地实景照
- CSCW Poster：Publications featured 卡片顶部显示论文 Poster + scan line 动画
- `/gallery` 路由：欧式沉浸画廊页面（水平滚动，画框 + 聚光灯 + 博物馆标签卡）

**新增内容类型字段**：
- `education[].logo?: string`
- `ExperienceItem.images?: string[]`
- `PublicationItem.image?: string`

**新增路由**：
- `/gallery` — 独立欧式画廊页面，7 个展厅，约 60 张旅行/生活照

---

## 1. Context

`resume.yibinfeng.com` 是 Yibin Feng 的个人 interactive portfolio，面向招聘方和技术同行。定位是"炫酷交互 + 展示技术深度"——通过 WebGL 3D 场景在视觉层面直接体现技术能力，通过内容层展示研究成果和工程经历。

---

## 2. Goals & Non-Goals

**Goals**：
- 访客 5 秒内感受到"这是一个技术很强的人"
- WebGL 3D 场景直接展示技术深度（Hero 节点图是 CSCW 2025 Multi-Agent 研究的可视化）
- 平滑滚动 + 每个 Section 都有 scroll-triggered 动画
- 英文为主，支持中文切换，内容完整双语

**Non-Goals**：
- 不做 CMS 后台（内容写死在 TypeScript 文件里）
- 不做 `/en`、`/zh` 路由（`output: 'export'` 静态站，`next-intl` middleware 不兼容）
- 不做联系表单（静态站无 API，邮件链接足够）

---

## 3. 受众

| 受众 | 来这里找什么 |
|------|-------------|
| 招聘方 / HR | 技术背景、教育经历、项目链接 |
| 技术同行 | 技术栈、开源项目、论文 |
| 学术圈 | CSCW 论文详情、研究方向 |

---

## 4. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 14** (`output: 'export'`) | SEO + 静态导出，已有骨架 |
| 3D 渲染 | **纯 Three.js 0.168**（非 R3F） | 最大控制粒度，顶级 portfolio 选择（Bruno Simon, Giulio） |
| 动画 | **GSAP ^3.12 + ScrollTrigger** | 行业标准，Awwwards 获奖站通用选择 |
| 平滑滚动 | **Lenis ^1.1** | 现代 Locomotive Scroll 替代，与 GSAP 完美集成 |
| 文字动画 | **split-type ^0.3** | GSAP SplitText 免费替代，逐字符/词动画 |
| 组件动画 | Framer Motion ^11（保留） | 仅用于 Navbar/移动端菜单微交互 |
| 样式 | Tailwind CSS v4 | 继承 Portal 设计 token |
| 语言 | TypeScript strict | 已配置 |

### package.json 变更

**移除**：
- `react-three-fiber`（旧包名，已被 `@react-three/fiber` 替代，但本项目不用 R3F）
- `@react-three/drei`（依赖 R3F，不需要）
- `next-intl`（middleware 在 `output: 'export'` 下不运行）

**新增**：
- `gsap ^3.12`
- `lenis ^1.1`
- `split-type ^0.3`

**保留**：`three ^0.168`，`framer-motion ^11`，`clsx`，`tailwind-merge`，`next ^14`

---

## 5. 页面结构（单页，hash 锚点导航）

```
Navbar（固定顶部）
├── Section 1 — Hero        # 全屏 Three.js Canvas + 姓名/定位文字
├── Section 2 — About       # 头像 + bio + StatCard
├── Section 3 — Skills      # 3 列技能徽章
├── Section 4 — Experience  # 垂直时间线（3 段经历）
├── Section 5 — Projects    # 2 列项目卡片（4 张）
├── Section 6 — Publications # CSCW 2025 featured + 2 篇 secondary
└── Section 7 — Contact     # Email / GitHub / LinkedIn
Footer
```

---

## 6. Hero 3D 场景

**概念：Multi-Agent 神经网络节点图**

80–90 个漂浮节点（`IcosahedronGeometry`）+ 动态脉冲连线，颜色使用 `[#00D4FF, #6366F1, #8B5CF6]` 循环分配。节点通过正弦函数缓慢漂移，连线基于节点间距（阈值 2.5 units）动态构建。

**叙事逻辑**：Hero 场景是 CSCW 2025 论文"Multi-Agent Systems Shape Social Norms"的直接可视化——不是通用技术炫技，而是研究内容本身。

### 技术实现要点

**Three.js 与 Next.js 集成**（关键，避免 SSR 报错）：
```
page.tsx (Server Component)
  └── dynamic(() => import('./HeroCanvas'), { ssr: false })
        └── HeroCanvas.tsx ('use client')
              └── useEffect → new ThreeScene(canvasRef.current)
                    └── lib/scene/ThreeScene.ts（纯 TS class，无 React 依赖）
```

**场景参数**：
- Canvas：`position: fixed; inset: 0; z-index: 0; pointer-events: none`，`alpha: true`
- 相机：`PerspectiveCamera(60, aspect, 0.1, 100)`，初始位置 `(0, 0, 8)`
- 节点：`InstancedMesh`（1 个 draw call，非 90 个独立 Mesh）
- 连线：预分配 `BufferGeometry`，每帧更新 `drawRange`（避免 GC）
- 灯光：`AmbientLight(0xffffff, 0.4)` + `PointLight(#00D4FF, 3, 25)` 置于原点
- 鼠标视差：`setMouse(nx, ny)` → 相机每帧 lerp `factor 0.05`，偏移上限 `±0.5, ±0.3`
- 滚动淡出：滚动超过 Hero 时 canvas wrapper opacity `1 → 0.15`
- `pixelRatio` 上限 2（桌面）/ 1.5（移动）

**移动端降级**：节点减至 35，去掉连线渲染，`pixelRatio` 上限 1.5。

---

## 7. 文件结构

```
apps/resume/
├── app/
│   ├── globals.css                      # 设计 token CSS 变量 + Tailwind v4 @theme
│   ├── layout.tsx                       # 字体（next/font）、LocaleProvider、SmoothScrollProvider
│   └── page.tsx                         # 单页组装：dynamic HeroCanvas + Navbar + 7 个 Section
│
├── components/
│   ├── canvas/
│   │   └── HeroCanvas.tsx               # 'use client'：useEffect 挂载/销毁 ThreeScene
│   ├── layout/
│   │   ├── Navbar.tsx                   # 固定顶部：锚点导航、LocaleToggle、滚动进度条
│   │   └── Footer.tsx                   # 版权信息
│   ├── sections/
│   │   ├── HeroSection.tsx              # 全屏：姓名、typewriter 定位、CTA、下滑提示
│   │   ├── AboutSection.tsx             # 头像 + bio + 3 × StatCard
│   │   ├── SkillsSection.tsx            # 3 列 SkillBadge 分组
│   │   ├── ExperienceSection.tsx        # 垂直时间线 3 段
│   │   ├── ProjectsSection.tsx          # 2 列 4 张 ProjectCard
│   │   ├── PublicationsSection.tsx      # Featured CSCW + 2 secondary
│   │   └── ContactSection.tsx           # 3 个 CTA 链接
│   ├── ui/
│   │   ├── SectionTitle.tsx             # h2 + 词级 stagger 动画
│   │   ├── StatCard.tsx                 # count-up 数字卡片
│   │   ├── SkillBadge.tsx               # 发光药丸标签（hover: border → cyan）
│   │   ├── TimelineItem.tsx             # 时间线节点 + 卡片（L/R 交替）
│   │   ├── ProjectCard.tsx              # 3D tilt hover + 技术标签 + 状态 badge
│   │   ├── PublicationCard.tsx          # 渐变边框研究卡片
│   │   ├── GlowButton.tsx               # 渐变发光 CTA 按钮
│   │   └── LocaleToggle.tsx             # EN / 中 切换按钮
│   └── providers/
│       ├── LocaleProvider.tsx           # EN/ZH context + localStorage 持久化
│       └── SmoothScrollProvider.tsx     # Lenis init + GSAP ScrollTrigger proxy
│
├── lib/
│   ├── content/
│   │   ├── types.ts                     # SiteContent 及子接口定义
│   │   ├── en.ts                        # 英文内容常量（实现 SiteContent）
│   │   └── zh.ts                        # 中文内容常量（镜像结构）
│   ├── scene/
│   │   ├── ThreeScene.ts                # 主类：renderer、camera、RAF loop、resize、dispose
│   │   ├── NodeGraph.ts                 # InstancedMesh 节点图：构建、更新、dispose
│   │   └── types.ts                     # SceneConfig 接口（无魔法数字）
│   ├── animations/
│   │   ├── scrollAnimations.ts          # 所有 ScrollTrigger 注册（一次性调用，带注释）
│   │   └── textReveal.ts                # SplitType + GSAP 字符/词语 stagger 工具函数
│   └── utils.ts                         # cn() = clsx + tailwind-merge
│
├── hooks/
│   ├── useLocale.ts                     # useContext(LocaleContext) 快捷访问
│   ├── useCountUp.ts                    # IntersectionObserver + rAF 数字动画
│   ├── useScrollProgress.ts             # 归一化 [0,1] 滚动位置
│   └── useMousePosition.ts              # 归一化 [-1,1] 鼠标位置
│
└── public/
    ├── avatar.jpg                        # 头像照片
    └── og-image.png                      # 1200×630 OG 图
```

---

## 8. 内容数据

### 个人信息
- 姓名：Yibin Feng / 冯一镔
- 定位：AI Engineer · Researcher · Builder
- Email：fengyibinapply@163.com
- LinkedIn：linkedin.com/in/yibinfeng-imperial
- GitHub：github.com/FengYibin66

### 教育（4 段）

| 院校 | 学位 | 专业 | 时间 | 备注 |
|------|------|------|------|------|
| National University of Singapore（世界 #8） | MSc | Computer Science | 2023–2025 | GPA 4.46/5 |
| Imperial College London（世界 #2） | MSc | General Structural Engineering | 2021–2022 | Merit，Research Project: Distinction |
| Sichuan University Jinjiang College | BEng | Civil Engineering | 2017–2021 | GPA 3.69/5，排名 1/148 |
| University of Malaya（QS #59） | Exchange | — | 2019–2020 | 吉隆坡，马来西亚 |

### 工作经历（3 段）

**1. 好未来/TAL Education（XueerSi）**  
职位：AI Agent Engineer P3 / 初级前端工程师  
时间：2025.07 – 至今，北京  
核心项目：
- AI Tutor 智能教学视频生成平台（2025.11–2026.01）
- One-CLI 统一全栈开发平台（2026.01–至今）
- 公域 AI 原创视频生产系统（2026.02–至今）
- 私域业务（Baichuan + 资源管理 + 4C 社群平台）

**2. 路觅教育（Lumi Education）**  
职位：大学讲师 / 研究生论文导师（计算机科学）  
时间：2024.09 – 至今  
主讲：深度神经网络（CNN、RNN、Transformer）、数据分析

**3. McAllistern Group**  
职位：Structural (Design) Engineer  
时间：2022.10 – 2023.06，伦敦  
项目：HS2（欧洲最大基础设施项目），Euston Station 等

### 项目（4 个卡片）

| 项目 | 描述 | 技术 | 状态 | URL |
|------|------|------|------|-----|
| Resume Site | Interactive 3D personal portfolio | Three.js, GSAP, Next.js | Live | resume.yibinfeng.com |
| WeChat AI Platform | AI-driven content automation | Go, Vue 3, Python, FastAPI | Live | mpauto.yibinfeng.com |
| AI Tutor Video Generator | One-sentence-to-teaching-video pipeline | React, Python, LLM Agent | Live | — |
| One-CLI | Unified full-stack dev platform | Go, Docker, React | In Dev | — |

### 论文（3 篇）

**Featured（CSCW 2025）**：  
"Multi-Agent Systems Shape Social Norms for Prosocial Behavior Change"  
- 会议：CSCW Companion '25，October 18–22，2025，Bergen，Norway  
- 作者：**Yibin Feng**（第一作者），Tianqi Song，Yugin Tan，Zicheng Zhu，Yi-Chieh Lee  
- DOI：https://doi.org/10.1145/3715070.3749246  
- 关键结论：多 Agent 系统有效建立虚拟社会规范；内群体 Agent 比外群体显著提升捐款意愿（62% vs 25%，χ²=3.95，p<0.05）；内群体条件下从众压力显著更高（p<0.01）  
- Keywords：Multi-agent Systems, Social Norm, Social Identity, Donation, LLM Agent

**Secondary 1**：  
"Multi-Agents as Social Groups: Investigating Social Influence of Multiple Agents in Human-Agent Interactions"  
- arXiv:2411.04578，ACM  

**Secondary 2**：  
"Greater than the Sum of its Parts: Exploring Social Influence of Multi-Agents"  
- CHI Extended Abstracts 2025，ACM  

### About StatCard（3 个）
- `4.46 / 5.0` — NUS GPA
- `CSCW 2025` — First Author Publication
- `3+` — Production AI Systems

### 技能分组（3 列）
1. **AI & Research**：GPT/LLM Integration, Prompt Engineering, Multi-Agent Systems, Workflow Automation, RAG Pipelines
2. **Frontend & Full-Stack**：React, Next.js, TypeScript, Vue 3, Three.js, Tailwind CSS, Node.js, Go/Gin
3. **Tools & Infra**：Docker, Python/FastAPI, Git/GitHub Actions, Nginx, Linux, MySQL, WeChat Mini Program

---

## 9. Scroll 动画编排

Lenis + GSAP ScrollTrigger proxy 模式，所有触发器在 `lib/animations/scrollAnimations.ts` 一次性注册：

| 触发点 | 效果 |
|--------|------|
| Hero 离开视口 | Canvas wrapper opacity `1 → 0.15` |
| About 进入 | StatCard count-up 启动；bio 文字 `y 40→0, opacity 0→1`（stagger） |
| Skills 进入 | 技能徽章从左飞入 `x -30→0`，stagger `0.04s` |
| Experience 进入 | 时间线竖线 height `0→100%`（scrub）；卡片左右交替 `x ±80→0, opacity 0→1` |
| Projects 进入 | 卡片 `scale 0.9→1, opacity 0→1`，stagger `0.08s` |
| Publications 进入 | Featured 卡片 `opacity 0→1, y 50→0`；渐变边框 opacity 动画 |
| Contact 进入 | 链接 `y 30→0, opacity 0→1` |

**文字动画（SplitType）**：
- Hero `<h1>`：字符级 stagger `0.03s/char`，初始延迟 0.4s
- 每个 `SectionTitle`：词级 stagger `0.05s/word`

---

## 10. i18n 实现

**方案**：单路由 `/` + client-side locale context，无 URL 路由段。

`next-intl` middleware 需要 Node.js runtime，与 `output: 'export'` 不兼容，移除该依赖，改用自定义 `LocaleContext`：
- `LocaleProvider` 从 `localStorage.getItem('resume-locale')` 初始化，默认 `'en'`
- `toggle()` 切换并写回 localStorage
- 组件内访问：`const { locale } = useLocale(); const c = content[locale]`
- `document.documentElement.lang` 在 `useEffect` 中更新

所有内容通过 `SiteContent` 接口强类型约束，`en.ts` 和 `zh.ts` 结构完全镜像，字段一一对应，编译时检查缺失翻译。

---

## 11. 设计 Token（继承 Portal）

```css
/* 暗色（默认） */
bg-base:    #070B12
bg-surface: #0D1220
bg-border:  #1E2740
accent-cyan:   #00D4FF
accent-indigo: #6366F1
accent-violet: #8B5CF6
text-primary:   #F0F4FF
text-secondary: #8B9BBC

/* 浅色 */
bg-base:    #F8FAFC
bg-surface: #FFFFFF
bg-border:  #E2E8F0
accent:     #0EA5E9
text-primary:   #0F172A
text-secondary: #64748B

/* 字体 */
display: Space Grotesk
body:    Inter
zh:      system-ui（PingFang SC / Microsoft YaHei 回退）

/* 选中色 */
::selection { background: #00D4FF33; color: #00D4FF }
```

---

## 12. 性能策略（目标 Lighthouse ≥ 85 桌面，≥ 70 移动）

- Three.js ESM named imports（tree-shaking），bundle ~200KB vs 全量 ~600KB
- `InstancedMesh`：90 节点 = 1 draw call
- `drawRange` 更新连线（无 GC，无重新分配缓冲区）
- `pixelRatio` 上限 2（桌面）/ 1.5（移动）
- `next/dynamic ssr:false`：Canvas 不阻塞 FCP；LCP = Hero 文字（Server Component 即时渲染）
- 所有动画只用 `transform` + `opacity`（GPU 合成层，无 layout 触发）
- 字体：`next/font/google` 自动 subset + `display: swap`
- 中文回退 system-ui，无字体下载

---

## 13. 代码架构规范

**模块化**：
- Section 组件只负责渲染，不直接调用 GSAP/Three.js
- 动画逻辑集中在 `lib/animations/`，组件通过 `ref` 暴露 DOM 节点
- Three.js 完全隔离在 `lib/scene/`，与 React 的唯一接口是 `ThreeScene` 的公有方法

**类型安全**：
- 无 `any`，无类型断言（`as`）
- Three.js 场景配置通过 `SceneConfig` 接口传递，无魔法数字
- 所有组件 props 显式定义接口

**可读性规范**：
- Section 组件 ≤ 120 LOC；`ThreeScene.ts` ≤ 200 LOC；`NodeGraph.ts` ≤ 150 LOC
- 每个 `ScrollTrigger` 注册有一行注释说明触发目标和效果
- `en.ts` 和 `zh.ts` 结构完全镜像

**副作用管理**：
- 所有 `addEventListener` 在 `useEffect` cleanup 中 `removeEventListener`
- `ThreeScene.dispose()` 用 `scene.traverse` 释放所有 geometry/material/texture
- `SmoothScrollProvider` unmount 时：`ScrollTrigger.getAll().forEach(t => t.kill())`，`lenis.destroy()`

**禁止**：
- 跨 Section 的全局 CSS class 修改
- Server Component 中使用 `useState`/`useEffect`
- React 组件内使用 `document.querySelector`（用 `ref` 替代）

---

## 14. 部署

`output: 'export'` 生成 `out/` 静态目录，Nginx 容器 serve。构建命令：

```bash
pnpm --filter @yibin/resume build
# 生成 apps/resume/out/
```

Docker（多阶段）：
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @yibin/resume build

FROM nginx:1.25-alpine
COPY nginx/resume.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/resume/out /usr/share/nginx/html
EXPOSE 80
```

开发端口：`resume.yibinfeng.com:3000`（`next dev -p 3000`，对应 infra spec 端口分配）。

---

## 15. Open Questions（实现前必须确认）

- [x] **Hero 3D 概念**：Multi-Agent 节点图（对应 CSCW 2025 研究主题）
- [x] **技术栈**：纯 Three.js + GSAP + Lenis（非 R3F，追求视觉上限）
- [x] **语言策略**：英文为主，client-side 中文切换，单路由
- [x] **内容来源**：简历 PDF + CSCW Poster PDF（已读取）
- [x] **头像图片**：使用 `/Users/tal/Desktop/个人文件/个人照片/Yibin.jpg`（CSCW 2025 现场照），复制到 `public/avatar.jpg`
- [x] **浅色/暗色切换**：需要，与 Portal 保持一致——`data-theme` attribute 驱动，切换状态持久化到 localStorage，Navbar 右侧 ☀️/🌙 图标

---

## 16. 验收标准

### 视觉 / UX
- [ ] Hero Three.js 场景页面打开 2 秒内加载并动画
- [ ] 鼠标移动时相机视差平滑响应（lerp，无抖动）
- [ ] 滚动超过 Hero 时 Canvas 淡至约 15% 不透明度
- [ ] 所有 ScrollTrigger 动画首次触发流畅（60fps，M 系 MacBook）
- [ ] EN/ZH 切换即时无刷新，刷新后保持语言偏好
- [ ] About 数字 count-up 首次滚动到视口时触发
- [ ] Experience 时间线竖线随滚动"绘制"
- [ ] 项目卡片 3D tilt hover（±6 度上限，鼠标离开时弹回）
- [ ] CSCW 2025 Featured 卡片有渐变边框动画
- [ ] 移动端（375px）布局无溢出，Three.js 降级正常

### 技术
- [ ] `pnpm --filter @yibin/resume build` 零 TypeScript 错误
- [ ] 生成 `apps/resume/out/` 目录（静态导出）
- [ ] 浏览器 console 无 React hydration 错误
- [ ] 浏览器 console 无 Three.js WebGL context 警告
- [ ] `react-three-fiber`、`@react-three/drei`、`next-intl` 已从 package.json 移除
- [ ] 无 `any` 类型断言（TypeScript strict 通过）

### 性能
- [ ] Lighthouse Performance ≥ 85（桌面，无限流）
- [ ] Lighthouse Performance ≥ 70（移动，Slow 4G）
- [ ] LCP ≤ 2.5s

### 内容
- [ ] 7 个 Section 英文内容全部正确渲染
- [ ] 切换中文后 7 个 Section 内容正确
- [ ] 所有外链 `target="_blank" rel="noopener noreferrer"`
- [ ] Email 复制到剪贴板功能有效
- [ ] CSCW DOI 链接有效（https://doi.org/10.1145/3715070.3749246）
