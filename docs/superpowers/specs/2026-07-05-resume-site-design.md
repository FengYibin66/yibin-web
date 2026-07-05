# Yibin Feng 个人简历网站 — 设计文档

**日期**: 2026-07-05  
**目标**: 从零构建一个互动3D沉浸式个人简历主页，部署到 `resume.yibinfeng.com`

---

## 1. 背景与目标

冯一镔现有 GitHub Pages 静态站（fengyibin66.github.io）质量较低，需要一个全新的、高质量个人品牌展示页。目标：

- 展示 AI Agent 工程师 + 前端开发者的双重身份
- 突出 CSCW 2025 第一作者论文、NUS GPA 4.46/5.0 等亮点
- 视觉效果酷炫、令人印象深刻（互动3D背景、流畅动画）
- 中英双语切换，覆盖国际和国内两个招聘市场
- 部署在独立子域名 `resume.yibinfeng.com`，与现有服务隔离

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|---------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS（扩展自定义 token） |
| 3D背景 | React Three Fiber (R3F) + Three.js |
| 动画 | Framer Motion |
| 国际化 | next-intl（/en 和 /zh 路由） |
| 构建产物 | 静态导出（`output: 'export'`），生成 `/out` 目录 |
| 容器 | Docker 多阶段构建 → Nginx Alpine 服务静态文件 |
| SSL | Let's Encrypt certbot，独立申请 resume.yibinfeng.com 证书 |
| 部署 | 腾讯云香港，Ubuntu 22.04，IP `49.233.142.172` |

---

## 3. 页面内容结构

所有内容均有中英双语版本，存储于 `content/en.json` 和 `content/zh.json`。

### Section 1 — Hero（全屏首页）
- 背景：Three.js 粒子场（全屏固定层）
- 主标题：`冯一镔 / Yibin Feng`
- 副标题：打字机动画循环展示三个身份
  - "AI Agent Engineer"
  - "Frontend Developer"  
  - "Researcher @ CSCW 2025"
- 一句话定位：*"Building intelligent systems at the intersection of AI and human experience."*
- CTA按钮："View My Work"（发光脉冲边框）
- 底部滚动指示箭头（浮动动画）

### Section 2 — About
- 左：头像（六边形裁剪 + 旋转渐变边框）
- 右：两段介绍文字（多语言背景 + 技术哲学）
- 三个统计卡片（滚动进入时数字递增动画）：
  - `4.46 / 5.0` — NUS GPA
  - `CSCW 2025` — First Author
  - `3+` — Production Systems

### Section 3 — Experience（垂直时间轴）
桌面端左右交替，移动端单列。每张卡片从侧面滑入。

| # | 角色 | 公司 | 时间 | 地点 |
|---|------|------|------|------|
| 1 | AI Agent Engineer (P3) | 北京世纪好未来 | 2025.07–至今 | 北京 |
| 2 | 大学课程讲师 / 论文导师 | 路觅教育 Lumi Edu | 2024.09–至今 | 远程 |
| 3 | 结构(设计)工程师 | 麦卡利斯特集团 | 2022.10–2023.06 | 伦敦 |

### Section 4 — Research（学术亮点）
- 特色大卡片（渐变边框，视觉上最突出）
- 论文：《多智能体系统为亲社会行为改变塑造社会规范》
- 发表于 CSCW 2025（世界顶级HCI会议），第一作者
- 关键词标签、摘要摘录、论文链接
- 装饰性 SVG 社交网络图（静态或简单动画）

### Section 5 — Projects（3列网格）
每张卡片悬停时有3D倾斜效果（CSS perspective transform）。

| 项目 | 技术 | 描述 |
|------|------|------|
| AI Tutor 智能教学视频生成平台 | React, Python, LLM, Agent | 一句话生成教学视频全流程 |
| One-CLI 统一全栈开发平台 | Go, React, Docker, CLI | 30秒一键创建工程 |
| 公域业务系统（AI视频+素材库） | Vue, Python, FastAPI | AI原创视频生产自动化 |
| 私域业务（百川+4C社群平台） | Vue, qiankun微前端 | 三端联动精细化运营 |

### Section 6 — Skills（分域展示）
三个领域，技能以发光 pill badge 展示，悬停时发光增强：

- **AI & Agents**：多智能体系统, Prompt Engineering, CoT/反思机制, LLM接口封装, 工作流自动化
- **Frontend & Full-Stack**：React, Vue 3, Next.js, TypeScript, Go/Gin, Three.js, Tailwind CSS
- **Tools & Infra**：Docker, Nginx, Git/GitHub Actions, Linux, MySQL, Redis, WeChat Dev

### Section 7 — Education（横向卡片）
三卡并列，每张显示院校、学位、时间、GPA/荣誉：

- 新加坡国立大学 NUS — 计算机科学硕士，GPA 4.46/5 (2023–2025)
- 帝国理工大学 Imperial — 通用结构工程硕士，Distinction (2021–2022)
- 四川大学锦江学院 SUJC — 土木工程学士，GPA 3.69/5，排名1/148 (2017–2021)

### Section 8 — Contact
- Email：fengyibinapply@163.com
- GitHub：FengYibin66
- LinkedIn：yibinfeng-imperial
- 底部 footer：版权 + 语言切换

---

## 4. 视觉设计系统

### 配色
```
背景层:
  --bg-base:        #070B12   深近黑海军蓝
  --bg-surface:     #0D1220   卡片背景
  --bg-elevated:    #141926   悬浮面板/导航
  --bg-border:      #1E2740   细线边框

强调色:
  --accent-cyan:    #00D4FF   主强调色（电光青）— 发光、链接、高亮
  --accent-indigo:  #6366F1   次强调色（靛蓝）— 渐变、次级UI
  --accent-violet:  #8B5CF6   第三色（紫罗兰）— 标签、hover

文字:
  --text-primary:   #F0F4FF   主文字（微蓝白）
  --text-secondary: #8B9BBC   次要文字
  --text-muted:     #4A5568   时间戳/说明

渐变（用于边框、强调线）:
  linear-gradient(135deg, #00D4FF 0%, #6366F1 50%, #8B5CF6 100%)
```

### 字体
- **标题/Display**：Space Grotesk（几何感，技术气质）
- **正文**：Inter（最佳可读性）
- **数字/代码**：JetBrains Mono（开发者身份认同）
- **中文**：系统字体 PingFang SC / Microsoft YaHei（lang属性条件加载）

### 三层动画架构

**Layer 1 — 常驻环境（Three.js，无需交互）**  
背景粒子场持续运行，设置沉浸氛围

**Layer 2 — 滚动触发（Framer Motion `whileInView`）**  
- Section 标题：`opacity 0→1, y 30→0`，600ms
- 时间轴卡片：`opacity 0→1, x ±60→0`，700ms
- 项目网格：stagger 0.1s per card
- 统计数字：count-up 动画
- 技能下划线：`scaleX 0→1` 从左侧展开

**Layer 3 — 交互（hover/mouse）**  
- 项目卡片：3D tilt（CSS perspective，最大±8度）
- 按钮 hover：cyan glow 增强 + scale 1.02
- 导航链接：青色下划线从左滑入
- 自定义鼠标指针：小青色点，50ms lag 跟随

### Three.js 场景："神经星座"
- 约800个粒子（BufferGeometry Points），随机颜色（青/靛/紫）
- 约1200条连线（距离阈值 0.8 单位）
- 鼠标视差：相机位置随鼠标移动 ±0.3 单位（lerp平滑）
- 粒子漂移：时间驱动正弦偏移
- 连线透明度脉动（"呼吸"效果）
- 滚动后画布淡出至 20% 透明度
- 移动端降级：300粒子，无连线

---

## 5. 项目文件结构

```
yibin-resume/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          # 根布局，i18n provider，字体加载
│   │   └── page.tsx            # 单页入口，所有 Section
│   └── globals.css
├── components/
│   ├── canvas/
│   │   ├── NeuralBackground.tsx    # R3F Canvas 包装（ssr: false）
│   │   ├── ParticleField.tsx       # 粒子+连线几何体
│   │   └── CameraController.tsx   # 鼠标视差相机
│   ├── layout/
│   │   ├── Navigation.tsx          # 粘性导航 + 滚动进度条
│   │   ├── MobileMenu.tsx
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── About.tsx
│   │   ├── Experience.tsx
│   │   ├── Research.tsx
│   │   ├── Projects.tsx
│   │   ├── Skills.tsx
│   │   ├── Education.tsx
│   │   └── Contact.tsx
│   ├── ui/
│   │   ├── SectionTitle.tsx        # 带展开下划线的 Section 标题
│   │   ├── ProjectCard.tsx         # 3D tilt 卡片
│   │   ├── TimelineCard.tsx        # 时间轴条目
│   │   ├── SkillBadge.tsx          # 发光 pill 标签
│   │   ├── StatCard.tsx            # count-up 统计卡片
│   │   ├── GlowButton.tsx          # 脉冲发光按钮
│   │   └── LanguageToggle.tsx      # EN/中 切换
│   └── providers/
│       └── Providers.tsx
├── content/
│   ├── en.json                 # 英文内容
│   └── zh.json                 # 中文内容
├── hooks/
│   ├── useScrollProgress.ts
│   ├── useMouseParallax.ts
│   └── useCountUp.ts
├── lib/
│   ├── constants.ts
│   └── utils.ts                # clsx + tailwind-merge
├── public/
│   └── og-image.png
├── nginx/
│   └── site.conf               # 容器内 Nginx 配置
├── docker-compose.yml          # 生产部署
├── Dockerfile                  # 多阶段构建
├── scripts/
│   └── deploy.sh               # 服务器部署脚本
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. 部署架构

### DNS（腾讯云控制台操作一次）
```
类型: A记录
主机名: resume
值: 49.233.142.172
TTL: 600
```

### Dockerfile（多阶段构建）
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build
# 产物在 /app/out

FROM nginx:1.25-alpine AS runner
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/site.conf /etc/nginx/conf.d/site.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 容器内 Nginx（nginx/site.conf）
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    
    location ~* \.(js|css|png|jpg|webp|woff2|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location ~* \.html$ {
        expires 0;
        add_header Cache-Control "no-cache";
    }
    location / {
        try_files $uri $uri/ $uri.html /en/index.html;
    }
    location = / {
        return 302 /en/;
    }
}
```

### 服务器 docker-compose.yml
```yaml
version: '3.8'
services:
  resume:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: yibin_resume
    restart: unless-stopped
    ports:
      - "3001:80"
```

### 宿主机 Nginx（新增 server block）
位置：`/etc/nginx/conf.d/resume.conf`（或已有 Nginx Docker 容器的 conf.d 挂载）

```nginx
server {
    listen 80;
    server_name resume.yibinfeng.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name resume.yibinfeng.com;
    ssl_certificate     /etc/letsencrypt/live/resume.yibinfeng.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/resume.yibinfeng.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    location / {
        proxy_pass       http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL 证书申请（DNS生效后执行一次）
```bash
sudo certbot --nginx -d resume.yibinfeng.com
```

### 部署脚本（scripts/deploy.sh）
```bash
#!/bin/bash
set -e
cd /var/projects/yibin_resume
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
echo "=== Deployed ==="
docker compose ps
```

---

## 7. 本地开发流程

```bash
# 安装依赖
npm install

# 本地开发（热更新）
npm run dev
# 访问 http://localhost:3000/en 或 /zh

# 测试静态导出（部署前必须测试）
npm run build
npx serve out
# 访问 http://localhost:3000/en/

# 完整 Docker 测试（最接近生产环境）
docker build -t resume-test .
docker run -p 8080:80 resume-test
# 访问 http://localhost:8080/en/
```

---

## 8. 关键依赖

```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.x",
    "react-dom": "18.x",
    "framer-motion": "^11.x",
    "three": "^0.168.x",
    "@react-three/fiber": "^8.x",
    "@react-three/drei": "^9.x",
    "next-intl": "^3.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/three": "^0.168.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "tailwindcss": "^3.x"
  }
}
```

---

## 9. 待确认事项（实施前）

- [ ] 是否有头像照片？（About section 六边形图片框）
- [ ] CSCW 2025 论文实际标题确认
- [ ] 联系方式是否公开 LinkedIn URL 和邮箱（页面可见）
