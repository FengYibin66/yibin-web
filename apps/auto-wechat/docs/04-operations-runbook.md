# 04 · 运维手册（Runbook）

> 文档版本：**v1.0**  
> 最后更新：2026-06-02  
> 技术栈：Go (api/worker) + llm-service + Vue + MySQL + Redis (asynq)

---

## 1. 概述

本文档覆盖 MVP 运维：Docker Compose 部署、Pipeline Run 排查、备份与成本。定时任务见 V1（asynq Scheduler）。

---

## 2. 服务清单

| 容器 | 说明 | 日志 |
|------|------|------|
| `nginx` | 反代 `/api` + Vue 静态 | `docker compose logs nginx` |
| `api` | Gin HTTP :8080 | `docker compose logs api` |
| `worker` | asynq Pipeline Worker | `docker compose logs worker` |
| `llm-service` | LangChain :8090（内网） | `docker compose logs llm-service` |
| `mysql` | MySQL 8.4 | — |
| `redis` | Redis 7 + asynq 队列 | — |

---

## 3. 日常检查（MVP）

| 检查项 | 命令 / 方式 | 正常 |
|--------|-------------|------|
| API 存活 | `curl localhost:8080/api/v1/health` | `ok` |
| 就绪 | `curl localhost:8080/api/v1/health/ready` | db+redis+llm ok |
| LLM 服务 | `curl http://llm-service:8090/health`（容器内） | ok |
| 最近 Run | `GET /api/v1/pipeline/runs?limit=5` | 无异常 failed |
| 资源 | `docker stats` | 内存 <85% |

**V1 追加：** 定时 Run 是否按时、企微告警是否送达。

---

## 4. 部署与更新

### 4.1 首次部署

```bash
git clone <repo> && cd auto_wechat_tech_content
cp .env.example .env.production
# 编辑 .env.production（或挂载 .env.development 仅 dev）

docker compose -f docker-compose.yml up -d --build

# 数据库迁移
docker compose exec api migrate up
# 或：make migrate-up

# 种子 RSS 源
docker compose exec api seed-sources

curl -H "X-API-Key: $ADMIN_API_KEY" http://localhost:8080/api/v1/health/ready
```

### 4.2 更新

```bash
git pull
docker compose build api worker llm-service
docker compose up -d
docker compose exec api migrate up
```

### 4.3 回滚

```bash
git checkout <tag>
docker compose build && docker compose up -d
# DB 回滚谨慎：migrate down 1
```

---

## 5. 故障排查

### 5.1 Pipeline Run 失败

```
1. GET /api/v1/pipeline/runs/{id}
   → 看 failed 的 step 名

2. 查 pipeline_run_steps 表 output_json / error_message
   docker compose -f docker-compose.dev.yml exec mysql \
     mysql -uwechat -pchange_me wechat_ai \
     -e "SELECT step, status, error_message FROM pipeline_run_steps WHERE run_id='...';"

3. worker 日志
   docker compose logs worker --since 30m | grep run_id

4. 手动重试：POST /api/v1/pipeline/runs（新 Run）
```

### 5.2 LLM 调用失败

```
1. llm-service 日志
   docker compose logs llm-service --tail 100

2. DASHSCOPE_API_KEY 余额 / 限流

3. Go 降级：
   - rank 失败 → 规则排序
   - writer 失败 → Run failed

4. 单独测 llm-service：
   curl -X POST http://localhost:8090/v1/llm/invoke \
     -H "Content-Type: application/json" \
     -d '{"agent":"ranker","input":{...}}'
```

### 5.3 微信 API 失败

| errcode | 处理 |
|---------|------|
| 40164 | IP 不在白名单 → 开发者平台添加 CVM 公网 IP |
| 40001 | AppSecret 错误 → 检查 `.env` |
| 40007 | 缺封面 thumb_media_id → 检查 Publish 上传逻辑 |
| 48001 | freepublish 无权限 → 正常，仅用 draft/add |

Token 缓存 Redis key：`wechat:access_token`

### 5.4 采集过少

```
1. GET /api/v1/sources
2. worker 日志 collect 步骤
3. 香港 CVM 外网是否通
4. RSS URL 是否变更
```

### 5.5 asynq 队列堆积

```bash
docker compose exec redis redis-cli LLEN asynq:{default}:pending
docker compose ps worker   # worker 必须 running
docker compose restart worker
```

---

## 6. 备份

| 数据 | 方式 | 频率 |
|------|------|------|
| MySQL | `mysqldump` → gzip → COS `backups/` | V1 每日 03:00 |
| `.env*` | 安全存储，非 Git | — |
| Redis | 可重建 | — |

```bash
docker compose -f docker-compose.dev.yml exec mysql \
  mysqldump -uwechat -pchange_me wechat_ai | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## 7. 告警（V1）

| 规则 | 通知 |
|------|------|
| Run failed | 企微 Webhook |
| llm-service 连续 5xx | 企微 |
| 磁盘 >85% | 企微 |

---

## 8. 常用命令

```bash
# 手动触发 Pipeline
curl -X POST http://localhost:8080/api/v1/pipeline/runs \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"publish_mode":"draft_only"}'

# Run 详情
curl -H "X-API-Key: $ADMIN_API_KEY" \
  http://localhost:8080/api/v1/pipeline/runs/{id}

# 服务状态
docker compose ps
make dev-up   # 本地
```

---

## 9. 相关文档

- [02-technical-architecture.md](./02-technical-architecture.md)
- [03-implementation-roadmap.md](./03-implementation-roadmap.md)
- [05-infrastructure-checklist.md](./05-infrastructure-checklist.md)
