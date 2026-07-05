# 03 · 实施路线图

> 文档版本：**v1.0**  
> 最后更新：2026-06-02  
> 技术栈：**Go + llm-service(LangChain) + Vue 3**  
> 状态：**开发基准**

---

## 1. 总体节奏

```
Phase 0  方案对齐 + 环境验证     ✅ 已完成
Phase 1  脚手架 + 基础设施       1 周
Phase 2  Pipeline 资讯段         1 周
Phase 3  Pipeline 内容 + 微信    1–2 周
Phase 4  Vue 控制台 + 联调       1 周
Phase 5  部署腾讯云 + 打磨       1 周
Phase 6  定时 + 看板（V1）       2 周+
Phase 7  扩展与稳定              持续
```

**MVP 交付目标（Phase 1–5，约 4–6 周）：**

- `POST /api/v1/pipeline/runs` 一键触发全链路
- 5–8 源 RSS → Top 10 → Editor/Writer/Layout/Review → **微信草稿箱**
- Vue 控制台：触发、Run 进度、成稿预览
- 运营者在 mp.weixin.qq.com 草稿箱点「发表」

---

## 2. Phase 0：方案对齐（已完成）

| 项 | 状态 |
|----|------|
| PRD v0.2、技术架构 v1.0 | ✅ |
| 百炼 LLM + `bl` CLI 连通 | ✅ |
| 微信 token + 草稿箱 API | ✅ |
| `.env.development` | ✅ |
| 技术栈：Go / LangChain Sidecar / Vue | ✅ |

---

## 3. Phase 1：脚手架 + 基础设施（第 1 周）

### 3.1 目标

Monorepo 可 `docker compose up`；Go API 健康检查；DB 迁移；llm-service 骨架。

### 3.2 任务清单

| # | 任务 | 栈 | 预估 |
|---|------|-----|------|
| 1.1 | 初始化 `backend/`（Go module、cmd/api、cmd/worker） | Go | 0.5d | ✅ |
| 1.2 | 初始化 `llm-service/`（FastAPI + LangChain health） | Python | 0.5d | ✅ |
| 1.3 | 初始化 `frontend/`（Vue3+Vite+TS+Element Plus） | Vue | 0.5d | ✅ |
| 1.4 | `docker-compose.dev.yml`：mysql、redis、api、llm-service | Docker | 0.5d | ✅ |
| 1.5 | golang-migrate + 初始 schema（pipeline_runs 等） | sqlc 可选 | 1d | ✅ |
| 1.6 | config 加载 `.env.development` | Go/Python | 0.5d | ✅ |
| 1.7 | Gin：`GET /health`、`GET /health/ready` | Go | 0.5d | ✅ |
| 1.8 | llm-service：`GET /health`、`POST /v1/llm/invoke` 桩 | Python | 0.5d | ✅ |
| 1.9 | `contracts/llm/*.schema.json` 初稿 | — | 0.5d | ✅ |
| 1.10 | `docs/06-frontend-standards.md` 落地到 frontend 模板 | Vue | 0.5d | ✅ |
| 1.11 | Makefile：`dev-up`、`migrate`、`lint` | — | 0.5d | ✅ |

### 3.3 验收标准

- [ ] `make dev-up` 后 api:8080、llm-service:8090 健康（需本机 Docker）
- [x] migrate SQL 与 `pipeline_runs` 表 schema 就绪
- [x] frontend `pnpm dev` 可访问三页 + API 层
- [x] 前端通过 ESLint + vue-tsc
- [x] Go `go build ./cmd/api ./cmd/worker` 通过

---

## 4. Phase 2：Pipeline 资讯段（第 2 周）

### 4.1 目标

异步 Run + 采集 → 去重 → Rank/Enrich（llm-service）。

### 4.2 任务清单

| # | 任务 | 预估 |
|---|------|------|
| 2.1 | asynq：`pipeline:execute` 任务 | 1d |
| 2.2 | `POST/GET /api/v1/pipeline/runs` | 0.5d |
| 2.3 | RSS Collector + Normalizer + Dedup（Go） | 1.5d |
| 2.4 | sources seed（5–8 源） | 0.5d |
| 2.5 | llm-service：ranker + enricher chains | 1d |
| 2.6 | Go `llmclient` HTTP 客户端 | 0.5d |
| 2.7 | Pipeline steps：collect→rank→enrich + run_steps 落库 | 1d |
| 2.8 | Rank 失败规则降级 | 0.5d |
| 2.9 | Go 单元测试：dedup、降级 | 1d |

### 4.3 验收标准

- [ ] `POST /pipeline/runs` 返回 run_id，Worker 异步执行
- [ ] Run 结束有 Digest（Top 10）写入 DB
- [ ] `GET /pipeline/runs/{id}` 可见各 step 状态
- [ ] llm-service 不可用时 Rank 降级仍出 Top N≥5

---

## 5. Phase 3：Pipeline 内容 + 微信（第 3–4 周）

### 5.1 目标

Editor/Writer/Layout/Reviewer + 微信草稿箱发布。

### 5.2 任务清单

| # | 任务 | 预估 |
|---|------|------|
| 3.1 | llm-service：editor、writer、layout、reviewer chains | 2d |
| 3.1b | Layout Engine：blocks + `wechatarticle` 渲染（见 [09-wechat-layout-methodology](./09-wechat-layout-methodology.md)） | ✅ |
| 3.2 | prompts/*.yaml + Pydantic 输出模型 | 1d |
| 3.3 | Review 驳回回 Writer/Layout（≤2 轮） | 1d |
| 3.4 | WeChatClient：token 缓存、upload、draft/add | 1.5d |
| 3.5 | Publish step（DRAFT_ONLY） | 0.5d |
| 3.6 | content_drafts + wechat_publish_results 表 | 0.5d |
| 3.7 | 封面：下载 og:image 或 COS | 1d |
| 3.8 | 端到端测试：一次 Run → 草稿箱有内容 | 1d |

### 5.3 验收标准

- [ ] 全链路 ≤15min（常规网络）
- [ ] 草稿箱可见新草稿（封面+正文）
- [ ] Reviewer 驳回时 step 记录清晰
- [ ] freepublish 不调用（个人号）

---

## 6. Phase 4：Vue 控制台 + 联调（第 4–5 周）

### 6.1 目标

运营者可 Web 触发并查看 Run；遵守 **fyb-frontend-standards**。

### 6.2 任务清单

| # | 任务 | 预估 |
|---|------|------|
| 4.1 | `api/request.ts` + `api/pipeline.ts` | 0.5d |
| 4.2 | `PipelineTriggerView`：一键 Run + 列表 | 1d |
| 4.3 | `RunDetailView`：StepTimeline + usePolling | 1.5d |
| 4.4 | `DraftPreviewView`：iframe 预览 + 草稿箱指引 | 1d |
| 4.5 | Pinia pipeline store | 0.5d |
| 4.6 | nginx 反代 `/api` + 静态资源 | 0.5d |
| 4.7 | 前端对照 `06-frontend-standards` 自检 | 0.5d |

### 6.3 验收标准

- [ ] 浏览器一键触发 Run 并成功
- [ ] Run 详情实时刷新至 succeeded/failed
- [ ] 成稿 HTML 预览正常（无 v-html 安全风险）
- [ ] 检查清单 §11 全部通过

---

## 7. Phase 5：部署 + 打磨（第 5–6 周）

| # | 任务 |
|---|------|
| 5.1 | 腾讯云香港 CVM + Docker Compose 生产配置 |
| 5.2 | COS 封面存储（可选 MVP 后期） |
| 5.3 | IP 白名单（服务器公网 IP） |
| 5.4 | Prompt 调优（2–3 轮） |
| 5.5 | Runbook 演练：失败排查 |

---

## 8. Phase 6+：V1/V2（后续）

| 阶段 | 内容 |
|------|------|
| V1 | asynq Scheduler 定时 Run；企微通知；15+ 源 |
| V2 | 数据看板；微信指标；Analyst chain |
| V3 | 多内容模板；竞品监控 |

---

## 9. 里程碑

| 里程碑 | 标志 |
|--------|------|
| **M1** 脚手架 | docker compose + health OK |
| **M2** 能采集排序 | Run 产出 Digest |
| **M3** 全链路 | 草稿箱有文章 |
| **M4** 能运营 | Vue 控制台可用 |
| **M5** 上云 | 腾讯云可访问 |

---

## 10. Phase 1 启动 Checklist

- [x] 技术架构 v1.0 定稿
- [x] `.env.development` 配置
- [x] 百炼 + 微信 API 验证
- [ ] Git 仓库初始化
- [ ] Go 1.22+ / Node 20+ / Python 3.11+ 本地就绪
- [ ] 品牌范文（可选，不挡开发）

---

## 11. Phase 8：单管理员登录（生产加固）

> 详设：[08-auth-single-admin.md](./08-auth-single-admin.md)

| # | 任务 | 状态 |
|---|------|------|
| 8.1 | 后端 Session 登录 API + 中间件 | ✅ |
| 8.2 | 前端登录页 + 路由守卫；移除 `VITE_API_KEY` | ✅ |
| 8.3 | CORS / Cookie / HTTPS 联调；轮换泄露 Key | 部署时执行 |

**前置：** 域名 + HTTPS 可用（`https://yibinfeng.com`）。

---

## 12. 相关文档

- [01-prd-product-design.md](./01-prd-product-design.md)
- [02-technical-architecture.md](./02-technical-architecture.md)
- [04-operations-runbook.md](./04-operations-runbook.md)
- [06-frontend-standards.md](./06-frontend-standards.md)
- [08-auth-single-admin.md](./08-auth-single-admin.md)
