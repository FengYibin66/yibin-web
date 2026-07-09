# Spec: 平台基础设施（Platform）

**状态**: Ready — 已实现  
**作者**: Yibin Feng  
**日期**: 2026-07-09  
**操作手册**: 本地见下文 §2；生产步骤见 [`DEPLOYMENT.md`](../../DEPLOYMENT.md)、[`AGENT_DEPLOYMENT_PROMPT.md`](../../AGENT_DEPLOYMENT_PROMPT.md)

Monorepo 含 Portal、Resume、Auto-Wechat 三个应用，共享 Docker 生产编排。本文是**环境变量、本地开发、生产部署**的唯一权威 Spec。

---

## 1. 环境变量与配置

### 1.1 背景与目标

历史上 env 分散在根目录与子项目（`.env.production.local`、`apps/auto-wechat/.env.development` 等），导致本地/生产靠 sed 切换、密钥重复、文档不一致。

- **密钥只维护一份**（`.env.shared.local`）
- **环境差异由 overlay 模板区分**，脚本合并，禁止手改 URL
- **后端 / Docker 只读 repo 根** 的 `.env.development` / `.env.production`
- **前端 `VITE_*`** 与后端 env 分离

**Non-Goals**：不在 Spec 中写具体密钥值；不使用已废弃的 `.env.production.local`、根 `.env.production.example`。

### 1.2 架构

```
config/env.shared.example          ─┐
.env.shared.local（密钥，gitignore）─┼─→ scripts/env-build.sh ─→ .env.development
config/env.development.example     ─┘                              .env.production
config/env.production.example      ─┘                              apps/portal/.env（dev only）
```

**合并顺序**（后者覆盖前者）：

1. `config/env.shared.example`
2. `.env.shared.local`
3. `config/env.{development|production}.example`
4. （可选）`ENV_EXTRA`，如 `config/env.ngrok.example`

脚本 **MUST** 将 `MYSQL_PASSWORD` 同步进 `DATABASE_URL`。

### 1.3 文件清单

**Repo 根 — 后端与 Docker**

| 路径 | Git | 用途 |
|------|-----|------|
| `config/env.shared.example` | ✅ | 密钥占位符 |
| `config/env.development.example` | ✅ | 本地 URL、`SESSION_SECURE=false` 等 |
| `config/env.production.example` | ✅ | 生产 https 域名等 |
| `config/env.shared.verify.example` | ✅ | 本地 prod compose 验证 mock |
| `config/env.production.localhost.example` | ✅ | 本地 prod compose localhost 覆盖 |
| `config/env.ngrok.example` | ✅ | 微信扫码预览 |
| `.env.shared.local` | ❌ | 真实密钥 |
| `.env.development` / `.env.production` | ❌ | 脚本生成 |

**Portal**：`apps/portal/.env.example`（✅）；`apps/portal/.env`（❌，development 时由 env-build 生成）

**Auto-Wechat 前端（仅 VITE_*）**：`frontend/.env.example`、`frontend/.env.production.example`（✅）；`frontend/.env.development` / `.env.production`（❌）

### 1.4 消费方

| 场景 | MUST 读取 |
|------|-----------|
| Portal dev | `apps/portal/.env` |
| Auto-Wechat Vite | `frontend/.env.development` |
| Auto-Wechat Docker dev | 根 `.env.development`（`make dev-up`） |
| 生产 Docker | 根 `.env.production` |
| Go / Python 服务 | 根 `.env.development` 或 `.env.production` |

### 1.5 禁止项

| 禁止 | 原因 |
|------|------|
| `apps/auto-wechat/` 根下 `.env`、`.env.development` | 已废弃 |
| `.env.production.local`、根 `.env.production.example` | 已删除 |
| 手改 `.env.development` / `.env.production` | 改模板或 `.env.shared.local` 后 re-run env-build |
| sed 切换 dev/prod 域名 | 用 overlay 模板 |
| verify 脚本内联 heredoc 写 env | 必须用 env-build + verify 模板 |

### 1.6 命令

```bash
cp config/env.shared.example .env.shared.local   # 填完 CHANGE_ME
./scripts/env-build.sh development               # 或 production
./scripts/env-build.sh production --check
ENV_EXTRA=config/env.ngrok.example ./scripts/env-build.sh development
```

pnpm：`pnpm env:dev` / `pnpm env:prod` / `pnpm env:check`

**实现**：`scripts/env-build.sh`、`config/env.*.example`、`apps/auto-wechat/backend/internal/config/config.go`、`apps/auto-wechat/llm-service/app/config.py`

---

## 2. 本地开发

### 2.1 域名（与生产一致）

| 应用 | 域名 |
|------|------|
| Portal | `www.yibinfeng.com` |
| Resume | `resume.yibinfeng.com` |
| Auto-Wechat | `mpauto.yibinfeng.com` |

通过 SwitchHosts + 本地反代实现；不开发时关闭 SwitchHosts，避免误连本地。

```
127.0.0.1  www.yibinfeng.com
127.0.0.1  resume.yibinfeng.com
127.0.0.1  mpauto.yibinfeng.com
```

### 2.2 端口

| 服务 | 端口 |
|------|------|
| portal Vite | 5173 |
| portal Hono | 3001 |
| resume Next.js | 3000 |
| auto-wechat Vite | 5174 |
| auto-wechat Go API | 8080 |
| auto-wechat LLM | 8090 |
| MySQL（Docker dev） | 3307 |

### 2.3 启动

**前置**：`./scripts/env-build.sh development`

```bash
pnpm dev:all          # portal + resume + wechat 前端
pnpm dev:portal       # http://www.yibinfeng.com:5173
pnpm dev:resume       # http://resume.yibinfeng.com:3000
pnpm dev:wechat       # http://mpauto.yibinfeng.com:5174

cd apps/auto-wechat && make dev-up   # Go + LLM + MySQL + Redis
```

Auto-Wechat 前端：`cp frontend/.env.example frontend/.env.development`（仅 `VITE_*`）。

### 2.4 验收

- [ ] `./scripts/env-build.sh development` 成功
- [ ] `pnpm dev:all` 无端口冲突；SwitchHosts 启用后三域名可访问
- [ ] `http://www.yibinfeng.com:5173/api/profile` 无 CORS 错误
- [ ] `make dev-up` 后 `curl localhost:8080/api/v1/health` 成功

---

## 3. 生产部署

### 3.1 架构

```
Internet :443/:80
    ↓
nginx-prod（SSL，静态 dist/out + 反代）
    ├─ www.yibinfeng.com      → portal dist + portal-server:3001
    ├─ resume.yibinfeng.com   → resume out/
    └─ mpauto.yibinfeng.com   → wechat frontend dist + auto-wechat-api:8080

yibin-net：mysql, redis, llm-service（仅 internal）
```

实现：`docker-compose.prod.yml`、`docker/nginx-prod.conf`

### 3.2 前置条件

| 项 | 要求 |
|----|------|
| CVM | Ubuntu 22.04+，Docker + Compose |
| DNS | 三域名 A 记录 → CVM IP |
| 防火墙 | 80、443 入站 |
| SSL | Let's Encrypt（certbot） |
| 密钥 | `.env.shared.local` + `./scripts/env-build.sh production --check` |

CVM **禁止**手改 `.env.production` 或使用已废弃的 `apps/auto-wechat/.env.development`。

### 3.3 部署顺序

1. SSH、Docker、clone（`/data` 或 `~/yibin-web`）
2. `cp config/env.shared.example .env.shared.local` → 填密钥 → `./scripts/env-build.sh production`
3. certbot 三域名证书
4. `docker compose -f docker-compose.prod.yml up -d --build`
5. 验收（§3.4）

### 3.4 验收

**容器**：7 个服务 Up（mysql, redis, nginx, portal-server, auto-wechat-api, auto-wechat-worker, llm-service）

```bash
curl -sf http://localhost:3001/health
curl -sf http://localhost:8080/api/v1/health
curl -sf https://www.yibinfeng.com/api/health
curl -sf https://resume.yibinfeng.com/
curl -sf https://mpauto.yibinfeng.com/api/v1/health
```

浏览器：三站点无证书警告、页面正常渲染。

### 3.5 环境变量验收（§1 补充）

- [ ] 无 `CHANGE_ME`；`DATABASE_URL` 密码与 `MYSQL_PASSWORD` 一致
- [ ] `apps/auto-wechat/` 根下无 `.env`、`.env.development`
- [ ] 生产 URL 为 https 域名，非 localhost

### 3.6 Non-Goals

- GitHub Actions 自动部署（可选，见 `DEPLOYMENT.md`）
- 多区域高可用、SSM 密钥托管

---

## 4. 应用与文档索引

| 域名 | 应用 Spec | 补充文档 |
|------|-----------|----------|
| www.yibinfeng.com | [portal-homepage.md](./portal-homepage.md) | — |
| resume.yibinfeng.com | [resume-site.md](./resume-site.md) | [lab-corridor-complete-spec.md](./lab-corridor-complete-spec.md) |
| mpauto.yibinfeng.com | — | [`apps/auto-wechat/docs/`](../../apps/auto-wechat/docs/)（PRD、架构、运维） |

Auto-Wechat 微信公众号后台需同步：JS-SDK 安全域名、OAuth 回调、`WECHAT_CALLBACK_URL`。
