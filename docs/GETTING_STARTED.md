# Getting Started — Local Development

## Quick Reference

| Command | Access URL |
|---------|-----------|
| `pnpm dev:portal` | http://www.yibinfeng.com:5173 |
| `pnpm dev:resume` | http://resume.yibinfeng.com:3000 |
| `pnpm dev:wechat` | http://mpauto.yibinfeng.com:5174 |

> **Note:** SwitchHosts must be active to use domain names. Otherwise use `localhost:port`

---

## Domain Architecture

| Application | Dev URL | Production |
|-------------|---------|-----------|
| Portal (main site) | `http://www.yibinfeng.com:5173` | `www.yibinfeng.com` |
| Resume | `http://resume.yibinfeng.com:3000` | `resume.yibinfeng.com` |
| Auto-Wechat | `http://mpauto.yibinfeng.com:5174` | `mpauto.yibinfeng.com` |

---

## One-Time Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Local Hosts (SwitchHosts)

Create a rule group named `yibin-local-dev` in SwitchHosts with:

```
127.0.0.1  www.yibinfeng.com
127.0.0.1  resume.yibinfeng.com
127.0.0.1  mpauto.yibinfeng.com
```

Enable it during development, disable when done (to access production sites).

### 3. Environment Variables

```bash
cp config/env.shared.example .env.shared.local
# Edit .env.shared.local — fill all CHANGE_ME values

./scripts/env-build.sh development   # or: pnpm env:dev
```

Auto-Wechat frontend (Vite only, separate from backend env):

```bash
cp apps/auto-wechat/frontend/.env.example apps/auto-wechat/frontend/.env.development
```

See [config/README.md](../config/README.md) and [specs/platform.md](./specs/platform.md) §1.

---

## Starting Frontend Applications

From the monorepo root:

```bash
# Start all frontend apps at once
pnpm dev:all

# Or start individually
pnpm dev:portal    # Portal client + server
pnpm dev:resume    # Resume site
pnpm dev:wechat    # Auto-Wechat frontend only
```

Then visit:
- http://www.yibinfeng.com:5173 (Portal)
- http://resume.yibinfeng.com:3000 (Resume)
- http://mpauto.yibinfeng.com:5174 (Auto-Wechat)

---

## Starting Backend Services

Auto-Wechat backend requires Docker Compose.

### Prerequisites

- Docker Desktop running

### Steps

```bash
cd apps/auto-wechat

# Start all backend services (MySQL, Redis, Go API, Python LLM, Worker)
make dev-up

# Verify health
make health
# Should show: ✅ Go API (8080) & ✅ LLM Service (8090)

# View logs
make dev-logs

# Stop services
make dev-down
```

### Troubleshooting

**Cannot connect to MySQL via Sequel Ace:**
```bash
make mysql-fix-auth
```

**After changing Go/Python code (non-hot-reload changes):**
```bash
make dev-build
```

---

## Port Allocation

| Service | Port |
|---------|------|
| Portal Vite client | 5173 |
| Portal Hono server | 3001 |
| Resume Next.js | 3000 |
| Auto-Wechat Vue Vite | 5174 |
| Auto-Wechat Go API | 8080 |
| Auto-Wechat Python LLM | 8090 |
| Auto-Wechat MySQL | 3307 |
| Auto-Wechat Redis | 6379 |

---

## Next Steps

- Explore code: Start with `apps/` directory
- Read specs: See [specs/README.md](./specs/README.md)
- Deploy to production: See [DEPLOYMENT.md](../DEPLOYMENT.md)
