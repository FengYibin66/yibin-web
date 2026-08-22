# Architecture

## Monorepo Structure

```
yibin-web/
├── apps/
│   ├── portal/                 # Main personal website + admin dashboard
│   │   ├── client/            # React frontend (Vite)
│   │   └── server/            # Hono backend (TypeScript)
│   ├── resume/                # Portfolio & resume site
│   │   └── (Next.js SSG)
│   └── auto-wechat/           # WeChat AI processing platform
│       ├── frontend/          # Vue + Vite
│       ├── backend/           # Go API server
│       ├── worker/            # Background task processor
│       └── llm-service/       # Python FastAPI LLM service
├── config/                     # Environment templates
├── docs/                       # Documentation
├── docker/                     # Docker build files
├── scripts/                    # Utility scripts
└── package.json               # Monorepo root (pnpm workspaces)
```

---

## Three Applications

### 1. Portal (www.yibinfeng.com)

**Tech Stack:** React 19 + Hono + TypeScript + Vite

**Purpose:** Personal website + admin dashboard

**Services:**
- `portal-client` — React Vite app (frontend)
- `portal-server` — Hono Node.js backend (3001)
- Database: **libSQL (SQLite-compatible) single file** via `@libsql/client` + Drizzle ORM — **not MySQL, and not shared with auto-wechat**. See ADR 20260822120802.

**Key Features:**
- Responsive personal website
- Admin dashboard for content management

### 2. Resume (resume.yibinfeng.com)

**Tech Stack:** Next.js SSG + TypeScript

**Purpose:** Portfolio & resume showcase site

**Services:**
- Static HTML files served via Nginx

**Key Features:**
- High-performance static site
- No runtime backend required

### 3. Auto-Wechat (mpauto.yibinfeng.com)

**Tech Stack:** Go + Vue 3 + Python + TypeScript

**Purpose:** WeChat official account AI assistant platform

**Services:**
- `auto-wechat-api` — Go backend (8080, HTTP + gRPC)
- `auto-wechat-frontend` — Vue Vite app (5174 dev, nginx prod)
- `auto-wechat-worker` — Background task processor (Go)
- `llm-service` — Python FastAPI for LLM calls (8090)
- Database: MySQL (shared)
- Cache: Redis

**Key Features:**
- WeChat message routing & AI response generation
- Message collection & content processing
- LLM integration (Alibaba Qwen models)

---

## Shared Infrastructure

### Data Storage

```
yibin-net (Docker network)
├── MySQL 8.4 (3306)
│   └── wechat_ai database — auto-wechat ONLY (portal does not use MySQL)
├── Redis 7 (6379)
│   └── Session cache + task queue — auto-wechat only
└── Nginx (80/443)
    └── HTTPS reverse proxy for three domains
```

**Portal 的持久层不在上面这张图里**——它是一个 libSQL 单文件库，不占 Docker 网络里的任何服务（ADR 20260822120802）。

> 这一节曾经写作「wechat_ai database (portal + auto-wechat)」，与实现从不相符。该错误的代价不是文档不整洁，而是它让读者（包括 AI）以为可以跨 portal 与 auto-wechat 做 join、共用连接池、共用迁移工具——这些一项都不成立。**portal 与 auto-wechat 之间没有共享持久层，跨两者的数据需求必须走接口。**

### Environment & Configuration

**Config Priority:**
```
env.shared.example (secrets)
    ↓
env.{development|production}.example (URLs/flags)
    ↓
scripts/env-build.sh (merge both)
    ↓
.env.production (generated, in .gitignore)
    ↓
Docker containers (mounted as env)
```

See [../config/README.md](../config/README.md) for details.

---

## Deployment Architecture

### Development

```
Your Machine
├── SwitchHosts: domain → 127.0.0.1
└── Applications
    ├── portal: localhost:5173 (client) + :3001 (server)
    ├── resume: localhost:3000
    ├── auto-wechat: localhost:5174 (frontend) + :8080 (API) + :8090 (LLM)
    └── MySQL/Redis: localhost:3307/6379
```

### Production (Tencent Cloud CVM)

```
CVM (Beijing · 49.233.142.172)
├── Nginx (reverse proxy, 80/443)
│   ├── www.yibinfeng.com → portal-server:3001
│   ├── resume.yibinfeng.com → nginx static (Resume)
│   └── mpauto.yibinfeng.com → auto-wechat-api:8080 + nginx (Vue)
├── Docker Network (yibin-net)
│   ├── portal-server:3001
│   ├── auto-wechat-api:8080
│   ├── auto-wechat-worker
│   ├── llm-service:8090
│   ├── MySQL:3306
│   └── Redis:6379
└── Volumes (data persistence)
    ├── mysql_data
    ├── redis_data
    └── media_data
```

**SSL:** Let's Encrypt certificates (/etc/letsencrypt/)

**CI/CD:** GitHub Actions → Docker Hub → SSH deploy to CVM

---

## Technology Stack

| Component | Tech | Version |
|-----------|------|---------|
| Package Manager | pnpm | ^9.0 |
| Frontend Framework | React | 19 |
| Backend (Portal) | Hono | Latest |
| Backend (Auto-Wechat) | Go | 1.21+ |
| LLM Backend | Python | 3.10+ |
| Frontend Build | Vite | ^5.0 |
| Next.js | ^15 |
| Vue | ^3.0 |
| Database | MySQL | 8.4 |
| Cache | Redis | 7.0 |
| Container Runtime | Docker | 20.10+ |
| Orchestration | Docker Compose | ^2.20 |
| Reverse Proxy | Nginx | Alpine |
| TypeScript | - | ^5.0 |

---

## Key Design Decisions

**决策理由不在本文件，在 [`docs/adr/`](./adr/AGENTS.md)。**

本节曾是一段六条的 bullet 列表，只说"选了什么"，不说为什么不选别的、代价是什么。它的第 3 条（"Portal & Auto-Wechat share MySQL"）与实现从不相符且长期无人察觉——因为它没有日期、没有状态、没有对应实现的锚点。这正是引入 ADR 制度的直接动因（ADR 20260822120805）。

现在的决策记录：

| ADR | 结论 |
|-----|------|
| 20260822120801 | Monorepo 承载三站：部署耦合决定仓库边界 |
| 20260822120802 | Portal 用 libSQL 单文件库，**不**复用 auto-wechat 的 MySQL |
| 20260822120803 | Resume 用 Next.js SSG，不保留运行时后端 |
| 20260822120804 | 单台 CVM + Docker Compose，不上 K8s |
| 20260822120805 | 引入 ADR 制度：不可变 + 前向指针 + 生成式索引 |
| 20260822120806 | AGENTS.md 分层上下文 |
| 20260822120807 | CI 质量门禁前置，生产发布改人工 promote |
| 20260822120808 | Portal 接口类型从 Drizzle schema 派生 |
| 20260822120809 | PreToolUse hooks 做机制门禁，fail-closed |

完整索引（含状态与前向指针）见 [`docs/adr/AGENTS.md`](./adr/AGENTS.md)，由脚本生成。

**尚未落 ADR 的既有做法**（发现时补，不要当成已批准的设计）：

- 前端构建期注入环境变量（secret 被打进 bundle）——这是**已知风险**，前端 bundle 里的任何值都等于公开，不要往里放真凭据
- Nginx 单入口反代承载 HTTPS、路由与缓存

---

## Development Workflow

1. Clone: `git clone https://github.com/FengYibin66/yibin-web.git`
2. Setup: `pnpm install`
3. Frontend: `pnpm dev:all`
4. Backend: `cd apps/auto-wechat && make dev-up`
5. Test: Visit domain URLs (with SwitchHosts enabled)
6. Commit & Push: GitHub Actions auto-deploys on merge to main

---

## See Also

- [GETTING_STARTED.md](./GETTING_STARTED.md) — Local dev setup
- [../DEPLOYMENT.md](../DEPLOYMENT.md) — Production deployment
- [specs/README.md](./specs/README.md) — Feature specs
