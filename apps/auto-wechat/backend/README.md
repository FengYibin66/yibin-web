# Backend — Go 主服务

Go + Gin + asynq + MySQL + Redis。

## 结构

```
backend/
├── cmd/api/          # HTTP API
├── cmd/worker/       # asynq Worker
├── internal/
│   ├── application/  # 用例层
│   ├── domain/       # 实体与常量
│   ├── infrastructure/
│   └── interface/http/
└── migrations/
```

## 本地运行（需 Postgres + Redis）

```bash
# 项目根目录
cp .env.example .env.development

# 终端 1 — API（自动 migrate）
cd backend
GOPROXY=https://goproxy.cn,direct go run ./cmd/api

# 终端 2 — Worker
GOPROXY=https://goproxy.cn,direct go run ./cmd/worker

# 终端 3 — llm-service
cd llm-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

## Docker Compose（推荐）

```bash
make dev-up
make health
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 存活 |
| GET | `/api/v1/health/ready` | DB + Redis + llm-service |
| POST | `/api/v1/pipeline/runs` | 创建 Run（需 `X-API-Key`） |
| GET | `/api/v1/pipeline/runs` | 列表 |
| GET | `/api/v1/pipeline/runs/{id}` | 详情 |

Worker 当前为 **stub**：顺序标记各 step 为 succeeded（Phase 2 替换为真实 Pipeline）。
