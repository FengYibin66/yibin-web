# README

AI 驱动的微信公众号自动化运营系统：一键 Pipeline（采集 → Top10 → 写作 → 排版 → 微信草稿箱）。

## 技术栈

| 层 | 技术 |
|----|------|
| 主后端 | Go · Gin · asynq · MySQL |
| LLM | Python · FastAPI · **LangChain** · 百炼 DashScope |
| 前端 | **Vue 3** · Vite · TypeScript · Element Plus · Pinia |
| 部署 | Docker Compose · 腾讯云香港 CVM |

## 架构要点

- **流程层（Go）**：Pipeline 状态机编排，API / 微信 / RSS / DB
- **语言层（Python）**：LangChain 仅负责 Prompt + LLM + 输出解析
- **前端规范**：遵循 [docs/06-frontend-standards.md](./docs/06-frontend-standards.md)（fyb-frontend-standards）

## 文档

| 文档 | 说明 |
|------|------|
| [docs/01-prd-product-design.md](./docs/01-prd-product-design.md) | 产品需求 |
| [docs/02-technical-architecture.md](./docs/02-technical-architecture.md) | 技术架构 v1.0 |
| [docs/03-implementation-roadmap.md](./docs/03-implementation-roadmap.md) | 实施路线 |
| [docs/04-operations-runbook.md](./docs/04-operations-runbook.md) | 运维手册 |
| [docs/05-infrastructure-checklist.md](./docs/05-infrastructure-checklist.md) | 环境依赖 |
| [docs/06-frontend-standards.md](./docs/06-frontend-standards.md) | 前端规范 |
| [docs/07-docker-local-setup.md](./docs/07-docker-local-setup.md) | **本地 Docker 配置与启动** |

## 本地开发

**首次启动前**：安装 Docker Desktop，并按 [docs/07-docker-local-setup.md](./docs/07-docker-local-setup.md) 配置阿里云镜像加速。

```bash
cp .env.example .env.development
make dev-up          # mysql, redis, api, worker, llm-service
make health
cd frontend && pnpm install && pnpm dev
```

Go 本地编译：`cd backend && GOPROXY=https://goproxy.cn,direct go run ./cmd/api`

## 数据库配置（MySQL）

本地库由 `docker-compose.dev.yml` 中的 `mysql` 服务启动，账号在 compose 里通过官方镜像环境变量初始化（**不是**在库里单独配置文件）。

| 项 | 开发环境默认值 |
|----|----------------|
| 主机 | `127.0.0.1`（宿主机连容器映射端口） |
| 端口 | **`3307`**（映射到容器内 3306；避免与本机已安装的 MySQL 抢 3306） |
| 数据库名 | `wechat_ai` |
| 用户名 | `wechat` |
| 密码 | `change_me` |
| root 密码 | `root_change_me`（仅管理用） |

定义位置：`docker-compose.dev.yml` → `services.mysql.environment`（`MYSQL_USER` / `MYSQL_PASSWORD` 等）。

应用连接串写在 **`.env.development`**（模板见 `.env.example`）：

```bash
DATABASE_URL=mysql://wechat:change_me@tcp(localhost:3307)/wechat_ai?parseTime=true&loc=UTC&charset=utf8mb4
```

- 容器内 api/worker 使用主机名 `mysql` 而非 `localhost`（compose 已覆盖）。
- API 启动时会自动执行 `backend/migrations/` 迁移。

**Sequel Ace / TablePlus 等 GUI**：选 MySQL，按上表填写；连不上时先执行 `docker compose -f docker-compose.dev.yml ps`，确认 `mysql` 为 healthy。

**Sequel Ace 报 `caching_sha2_password` / `Authentication requires secure connection`**：

MySQL **8.4** 默认禁用 `mysql_native_password`。本项目 compose 使用 **8.4** + `--mysql-native-password=ON`，并对 `wechat` 使用 `mysql_native_password`（见 `docker/mysql-init/`）。

**处理步骤（二选一）：**

1. **推荐**：重建数据卷  
   `docker compose -f docker-compose.dev.yml down -v && make dev-up`
2. **最常见**：本机已装 MySQL 占用 **3306**，Sequel Ace 连错实例。请用端口 **`3307`**（Docker 映射）。可执行 `lsof -i :3306` 看是否有本机 `mysqld`。
3. **保留数据**：在容器内执行 `docker/mysql-init/01-native-password.sql` 中的 `ALTER USER`（或 `make mysql-fix-auth`，若有）。

**改密码**：同时修改 `docker-compose.dev.yml` 中的 `MYSQL_PASSWORD` 与 `.env.development` 里 `DATABASE_URL` 的密码部分；若数据卷已初始化过，需 `docker compose -f docker-compose.dev.yml down -v` 后重新 `make dev-up`，或在 MySQL 内 `ALTER USER`。

**从旧 PostgreSQL 切换**：执行 `docker compose -f docker-compose.dev.yml down -v` 清掉旧 `pgdata` 卷后再 `make dev-up`（会新建 `mysqldata` 空库）。

## 微信读者侧来源展示

流水线会在排版后对 `body_html` 做后处理：每个来源链接后追加灰色明文 URL（便于微信内长按复制）。发布到草稿箱时，「阅读原文」优先级为：

1. 运营在控制台 **阅读原文下拉列表** 中选中的项（全站列表，每个 Run 记住上次选中；新建 Run 默认第一项）
2. 若未选且列表非空 → 列表第一项
3. 配置了 **`PUBLIC_API_BASE_URL`** 且上一步无选中 URL → 每期来源汇总页
4. 否则 **`WECHAT_READ_SOURCE_URL`**（默认 [https://fengyibin66.github.io/](https://fengyibin66.github.io/)）→ 第一条资讯原文

列表维护：`GET/POST/DELETE /api/v1/read-source-presets`（至少保留一条）。

## 服务器部署（单机 · GitHub 同步）

页面与 API **同源**：`http://公网IP/` + `http://公网IP/api/v1/...`，由 Nginx 反代，避免 80/8080 跨域导致登录失败。

**Mac：改代码 → push**

```bash
git add -A && git commit -m "..." && git push origin main
```

**服务器：pull + 部署**

```bash
cd ~/auto_wechat_tech_content
chmod +x scripts/deploy-server.sh
./scripts/deploy-server.sh
```

或手动：

```bash
git pull origin main
sudo docker compose -f docker-compose.dev.yml up -d --build api worker
cd frontend && pnpm install && pnpm build && cd ..
sudo docker compose -f docker-compose.dev.yml -f docker-compose.frontend.yml up -d frontend
```

**首次管理员**（表为空时执行一次）：

```bash
sudo docker compose -f docker-compose.dev.yml run --rm api \
  go run ./cmd/createadmin -username admin -password '强密码'
```

**前端生产 env**（服务器 `frontend/.env.production`，不提交 Git）：

```bash
cp frontend/.env.production.example frontend/.env.production
# 保持 VITE_API_BASE_URL=/api/v1
```

服务器 `.env.development` 建议：`ENV=production`、`SESSION_SECURE=false`（HTTP 阶段），备案后 HTTPS 再改 `true` 并换 `docker/nginx-site.conf`。

若曾手动 `docker run --name frontend`，先执行一次：`sudo docker rm -f frontend`。

## 环境配置

| 场景 | 文件 |
|------|------|
| 本地开发 | 复制 `.env.example` → `.env.development`；`PUBLIC_API_BASE_URL=http://localhost:8080` |
| 生产服务器 | 复制 `.env.production.example` → `.env.development`；`PUBLIC_API_BASE_URL=https://你的域名` |
| 手机微信预览 | 临时改 `PUBLIC_API_BASE_URL` 为 ngrok 地址（见 `.env.local.ngrok.example`） |

前端：`frontend/.env.development`（本地）、`frontend/.env.production`（构建，模板见 `frontend/.env.production.example`）。

LLM 模型：`LLM_MODEL_FAST=qwen-plus`（排序/富化/质检）、`LLM_MODEL_SMART` / `LLM_MODEL_LAYOUT=qwen3.7-max`（写作/排版）。

## 仓库结构（规划）

```
backend/          # Go 主服务
llm-service/      # Python LangChain 薄层
frontend/         # Vue 3 SPA
contracts/        # OpenAPI + LLM JSON Schema
docs/
```
