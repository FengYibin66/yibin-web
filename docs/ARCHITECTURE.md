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
- Database: MySQL (shared)

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
│   └── wechat_ai database (portal + auto-wechat)
├── Redis 7 (6379)
│   └── Session cache + task queue
└── Nginx (80/443)
    └── HTTPS reverse proxy for three domains
```

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
CVM (Hong Kong)
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

1. **Monorepo:** Single repo for coordinated development & deployment
2. **Unified Docker Compose:** All services orchestrated together in production
3. **Shared Database:** Portal & Auto-Wechat share MySQL (different schemas)
4. **Frontend Build-Time Secrets:** Environment variables baked into frontend bundles at build time
5. **Static Resume:** Next.js SSG for best performance (no runtime backend)
6. **Nginx Reverse Proxy:** Single entry point for HTTPS, routing, & caching

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
