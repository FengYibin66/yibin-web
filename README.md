# yibin_web

> A comprehensive monorepo hosting three independent web applications with unified Docker orchestration.

## 🏗️ Architecture

**Monorepo with three applications:**
- **Portal** — Personal website + Admin dashboard (Hono backend + React frontend)
- **Resume** — Portfolio & resume site (Next.js SSG + 3D scene)
- **Auto-Wechat** — WeChat AI processing platform (Go API + Vue frontend + Python LLM)

**Tech Stack:** TypeScript, React, Next.js, Hono, Go, Python, Docker Compose, MySQL, Redis

**Deployment:** Docker Compose on Tencent Cloud CVM (Hong Kong region) with HTTPS + Nginx reverse proxy

---

## 🚀 Quick Start

**Development:**
```bash
pnpm install              # Install dependencies
pnpm dev:all             # Start all frontend apps
cd apps/auto-wechat
make dev-up              # Start backend services
```

**Production Deployment:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

See [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) for detailed setup.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) | Local development setup |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design & monorepo structure |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment overview |
| [docs/deployment/AGENT_PROMPT.md](./docs/deployment/AGENT_PROMPT.md) | CVM deployment automation prompt |
| [docs/specs/README.md](./docs/specs/README.md) | Feature specifications |

---

## 🌐 Live Sites

- **Portal:** https://www.yibinfeng.com
- **Resume:** https://resume.yibinfeng.com
- **Auto-Wechat:** https://mpauto.yibinfeng.com

---

## 📋 License

© 2025 Feng Yibin. All rights reserved.
