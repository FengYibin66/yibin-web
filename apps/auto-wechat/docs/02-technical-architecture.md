# 02 · 技术架构方案

> 文档版本：**v1.0**  
> 最后更新：2026-06-02  
> 状态：**已定稿（开发基准）**  
> 关联：[01-prd-product-design.md](./01-prd-product-design.md) · [05-infrastructure-checklist.md](./05-infrastructure-checklist.md)

---

## 1. 架构概述

### 1.1 一句话

**Go 模块化单体**负责 API、Pipeline 编排与外部集成；**Python 薄服务 + LangChain** 仅负责 LLM 调用与 Prompt；**Vue 3 SPA** 负责运营控制台。

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **流程与语言分离** | Go 状态机决定「何时调谁」；LangChain 决定「怎么问模型、怎么解析」 |
| **不用 LangGraph** | Pipeline 步骤固定、分支有限；Go 显式状态机更可读、可测、可调试 |
| **LangChain 仅作 LLM SDK** | 不承载业务、不连 DB、不碰微信 |
| **六边形架构（Ports & Adapters）** | 领域层不依赖 Gin、GORM、LangChain、微信 SDK |
| **Pipeline Run 可回溯** | 每个阶段持久化 input/output，失败可定位、可重跑 |
| **MVP 可降级** | 部分 RSS 源失败继续跑；LLM 失败 Ranker 走规则排序 |
| **个人订阅号约束内设计** | 发布模式默认 `DRAFT_ONLY`（草稿箱 API 已验证） |

### 1.3 系统架构图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  frontend（Vue 3 + Vite + Element Plus）                                   │
│  · 一键触发 Pipeline  · Run 进度  · 成稿 HTML 预览                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / REST
┌───────────────────────────────▼──────────────────────────────────────────┐
│  backend（Go）— 主服务                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ HTTP API    │  │ Worker       │  │ Pipeline Engine（状态机）        │ │
│  │ Gin         │→ │ asynq        │→ │ Collect→Rank→…→Layout→Review→Pub│ │
│  └─────────────┘  └──────────────┘  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Infrastructure：RSS · WeChat · COS · MySQL · Redis                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP POST /v1/llm/invoke（内网）
┌───────────────────────────────▼──────────────────────────────────────────┐
│  llm-service（Python）— 薄 LLM 层                                           │
│  FastAPI + LangChain：PromptTemplate · ChatModel(DashScope) · OutputParser │
└──────────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        百炼 DashScope    微信公众号 API      腾讯云 COS
        RSS 外网源         （草稿箱）          （封面/配图）
```

### 1.4 技术栈总览

| 层级 | 选型 | 版本建议 | 职责 |
|------|------|----------|------|
| **主后端** | Go | 1.22+ | API、Pipeline、集成、持久化 |
| **HTTP 框架** | Gin | latest | REST、中间件、路由 |
| **任务队列** | asynq | + Redis 7 | 异步 Pipeline Worker |
| **数据库** | MySQL | 8.4 | 主存储 |
| **DB 访问** | database/sql | — | Repository 直连 SQL |
| **迁移** | golang-migrate | — | 版本化 SQL 迁移 |
| **LLM 服务** | Python + FastAPI | 3.11+ | 仅 LLM 调用 |
| **LLM SDK** | LangChain | 0.3+ | Prompt、Model、Parser |
| **LLM 提供商** | 阿里百炼 DashScope | — | 已连通验证 |
| **前端** | Vue 3 + Vite + TS | 3.4+ | 运营 SPA |
| **UI 组件** | Element Plus | — | 表格、步骤条、表单 |
| **状态管理** | Pinia | — | Run 状态、用户偏好 |
| **HTTP 客户端** | axios | — | 调 Go API |
| **对象存储** | 腾讯云 COS | 香港 | 封面、配图 |
| **部署** | Docker Compose | — | 腾讯云香港 CVM |
| **反向代理** | nginx | — | 静态资源 + API 反代 |

**明确不采用：**

| 不采用 | 原因 |
|--------|------|
| LangGraph | Go 主栈；Pipeline 不需通用图引擎 |
| Celery / FastAPI 主后端 | 与 Go 主服务重复 |
| Next.js | 内部 SPA，无 SSR/SEO 需求 |
| 微服务拆分 | MVP 复杂度不必要 |

---

## 2. 分层架构（六边形）

### 2.1 四层职责

```
┌─────────────────────────────────────────┐
│  interface/          接口层               │
│  HTTP handlers · middleware · DTO       │
├─────────────────────────────────────────┤
│  application/        应用层             │
│  PipelineService · DigestService        │
├─────────────────────────────────────────┤
│  domain/             领域层             │
│  entities · rules · ports (interfaces)  │
├─────────────────────────────────────────┤
│  infrastructure/     基础设施层         │
│  mysql · redis · wechat · rss · cos     │
│  llmclient (HTTP → llm-service)         │
└─────────────────────────────────────────┘
```

| 层 | 允许 | 禁止 |
|----|------|------|
| **interface** | 参数校验、鉴权、HTTP 状态码 | 业务规则、直接调 LangChain |
| **application** | 用例编排、事务边界、调 Pipeline | import 微信/RSS 具体实现 |
| **domain** | 实体、Port 接口、纯函数规则 | import 第三方 SDK |
| **infrastructure** | Port 实现、SQL、HTTP 客户端 | Pipeline 分支逻辑 |

### 2.2 Port 接口（领域层契约）

```go
// domain/port/llm.go — Go 只认识统一 LLM 端口，不认识 LangChain
type LLMClient interface {
    Invoke(ctx context.Context, agent string, input any, opts LLMOptions) ([]byte, LLMUsage, error)
}

// domain/port/wechat.go
type WeChatClient interface {
    AccessToken(ctx context.Context) (string, error)
    UploadImage(ctx context.Context, path string) (mediaID string, err error)
    CreateDraft(ctx context.Context, article DraftArticle) (mediaID string, err error)
}

// domain/port/collector.go
type Collector interface {
    Fetch(ctx context.Context, source Source) ([]RawArticle, error)
}

// domain/port/storage.go
type ObjectStorage interface {
    Put(ctx context.Context, key string, data []byte, contentType string) (url string, err error)
}
```

**可测试性：** 单元测试 Mock Port；集成测试用 testcontainer（MySQL、Redis）。

### 2.3 流程层 vs 语言层

| | 流程层（Go） | 语言层（Python + LangChain） |
|--|--------------|------------------------------|
| **职责** | 阶段顺序、重试、降级、落库 | Prompt 渲染、调模型、结构化解析 |
| **代码位置** | `internal/pipeline/` | `llm-service/chains/` |
| **是否决策** | Reviewer 驳回回 Writer 还是 Layout | 只返回 `{ pass, issues[] }` |
| **是否持久化** | 写 `pipeline_run_steps` | 无状态 |
| **部署** | `backend` 容器 | `llm-service` 容器 |

---

## 3. Pipeline 引擎（Go 状态机）

### 3.1 状态定义

```go
type PipelineStep string

const (
    StepCollect   PipelineStep = "collect"
    StepNormalize PipelineStep = "normalize"
    StepDedup     PipelineStep = "dedup"
    StepRank      PipelineStep = "rank"       // → llm-service
    StepEnrich    PipelineStep = "enrich"     // → llm-service
    StepEdit      PipelineStep = "edit"       // → llm-service
    StepWrite     PipelineStep = "write"      // → llm-service
    StepLayout    PipelineStep = "layout"     // → llm-service
    StepReview    PipelineStep = "review"     // → llm-service
    StepPublish   PipelineStep = "publish"    // → WeChat API
)

type RunStatus string

const (
    RunStatusQueued    RunStatus = "queued"
    RunStatusRunning   RunStatus = "running"
    RunStatusSucceeded RunStatus = "succeeded"
    RunStatusFailed    RunStatus = "failed"
    RunStatusCancelled RunStatus = "cancelled"
)
```

### 3.2 状态流转图

```mermaid
stateDiagram-v2
    [*] --> Queued
    Queued --> Collect: worker 领取
    Collect --> Normalize
    Normalize --> Dedup
    Dedup --> Rank
    Rank --> Enrich
    Enrich --> Edit
    Edit --> Write
    Write --> Layout
    Layout --> Review
    Review --> Publish: approved
    Review --> Write: content_reject (≤2)
    Review --> Layout: layout_reject (≤2)
    Publish --> Succeeded
    Review --> Failed: max_retries
    Collect --> Failed: fatal
    Succeeded --> [*]
    Failed --> [*]
```

### 3.3 引擎伪代码（可读性优先）

```go
func (e *Engine) Run(ctx context.Context, runID uuid.UUID) error {
    state := e.loadState(ctx, runID)

    steps := []stepFn{
        e.collect, e.normalize, e.dedup,
        e.rank, e.enrich, e.edit, e.write, e.layout,
        e.reviewWithRetry, // 内部处理 Writer/Layout 回环
        e.publish,
    }

    for _, fn := range steps {
        if err := e.runStep(ctx, runID, fn); err != nil {
            return e.failRun(ctx, runID, err)
        }
    }
    return e.completeRun(ctx, runID)
}
```

**每个 `runStep` 必须：**

1. 写 `pipeline_run_steps`：`status=running`
2. 执行业务逻辑
3. 持久化 `output_json`
4. 写 `status=succeeded|failed`、`duration_ms`

### 3.4 降级策略

| 步骤 | 失败时 |
|------|--------|
| Collect（部分源） | 记录 warning，用已成功源继续 |
| Rank（LLM） | 规则排序：来源权重 × 时间衰减 |
| Enrich（LLM） | 用原标题 + 空摘要 |
| Review（LLM） | 标记 `needs_human_review`，不阻塞 Publish（可配置） |
| Publish | Run 标记 failed，保留成稿供人工复制 |

---

## 4. Agent 与 LLM 服务

### 4.1 步骤分类

| 步骤 | 执行位置 | 是否调 llm-service |
|------|----------|-------------------|
| Collect | Go | ❌ |
| Normalize | Go | ❌ |
| Dedup | Go | ❌ |
| Rank | Go 调 `agent=ranker` | ✅ fast 模型 |
| Enrich | Go 调 `agent=enricher` | ✅ fast |
| Edit | Go 调 `agent=editor` | ✅ smart |
| Write | Go 调 `agent=writer` | ✅ smart |
| Layout | Go 调 `agent=layout` | ✅ smart |
| Review | Go 调 `agent=reviewer` | ✅ fast |
| Publish | Go 直调微信 | ❌ |

### 4.2 llm-service 统一接口

```http
POST /v1/llm/invoke
Content-Type: application/json

{
  "agent": "writer",
  "input": { ... },
  "options": {
    "model": "qwen-max",
    "temperature": 0.7
  }
}
```

```json
{
  "output": { ... },
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 800,
    "model": "qwen-max"
  }
}
```

```http
GET /health
GET /v1/agents
```

### 4.3 LangChain 链结构（每个 Agent 一个文件）

```python
# llm-service/chains/writer.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_community.chat_models import ChatTongyi

prompt = ChatPromptTemplate.from_file("prompts/writer.yaml")
parser = PydanticOutputParser(pydantic_object=WriterOutput)
chain = prompt | ChatTongyi(model="qwen-max") | parser
```

**Prompt 与代码分离：** 所有 Prompt 放 `llm-service/prompts/*.yaml`，改 Prompt 不改 Go。

### 4.4 Agent 输入/输出契约（Go ↔ Python 共享）

用 JSON Schema 或 OpenAPI 定义，放 `contracts/llm/`：

```
contracts/llm/
├── ranker.schema.json
├── enricher.schema.json
├── editor.schema.json
├── writer.schema.json
├── layout.schema.json
└── reviewer.schema.json
```

Go 与 Python 均据此生成/校验类型，**避免两边字段漂移**。

### 4.5 模型分级

| Agent | 模型 | 理由 |
|-------|------|------|
| ranker, enricher, reviewer, template_matcher | `qwen3.7-plus`（fast） | 分类/摘要/匹配/质检 |
| editor, writer | `qwen3.7-max`（smart） | 创作质量 |
| layout | `qwen3.7-max` + `max_tokens=32768` | 长 HTML few-shot 仿写 |

---

## 5. 微信公众号集成

### 5.1 已验证能力（Phase 0）

| API | 状态 | 说明 |
|-----|------|------|
| `stable_token` | ✅ | IP 白名单 `36.112.18.138` |
| `draft/count` | ✅ | |
| `material/add_material` | ✅ | 封面上传 |
| `draft/add` | ✅ | 需 `thumb_media_id` |
| `freepublish/submit` | ❌ `48001` | 个人未认证号不可用 |

### 5.2 发布模式

```go
type PublishMode string

const (
    PublishModeDraftOnly PublishMode = "draft_only" // MVP 默认
    PublishModeCopyHTML  PublishMode = "copy_html"  // 降级：仅输出 HTML
    // PublishModeAuto    PublishMode = "auto"       // V2：企业认证号
)
```

**Publish 步骤（DRAFT_ONLY）：**

1. 封面写入 COS（可选备份）→ 上传微信得 `thumb_media_id`
2. 正文 HTML 组装 `DraftArticle`
3. `draft/add` → 返回 `media_id`
4. API 响应含指引：`mp.weixin.qq.com → 内容管理 → 草稿箱 → 发表`

### 5.3 Token 管理

- Redis key：`wechat:access_token`
- TTL：`expires_in - 300`（提前 5 分钟刷新）
- 使用 `stable_token` 接口

---

## 6. 数据模型

### 6.1 ER 关系

```
sources 1──N articles
pipeline_runs 1──N pipeline_run_steps
pipeline_runs 1──o| daily_digests
pipeline_runs 1──o| content_drafts
content_drafts 1──o| wechat_publish_results
```

### 6.2 核心表

```sql
-- Pipeline 运行（聚合根）
CREATE TABLE pipeline_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status        TEXT NOT NULL DEFAULT 'queued',
    publish_mode  TEXT NOT NULL DEFAULT 'draft_only',
    triggered_by  TEXT,
    error_message TEXT,
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每阶段快照（可观测性核心）
CREATE TABLE pipeline_run_steps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    step          TEXT NOT NULL,
    status        TEXT NOT NULL,
    input_json    JSONB,
    output_json   JSONB,
    error_message TEXT,
    duration_ms   INT,
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    UNIQUE (run_id, step)
);

CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_run_steps_run_id ON pipeline_run_steps(run_id);

-- 数据源
CREATE TABLE sources (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'rss',
    url        TEXT NOT NULL,
    weight     REAL NOT NULL DEFAULT 1.0,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 文章（清洗后，去重用）
CREATE TABLE articles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id    UUID REFERENCES sources(id),
    title        TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    source_name  TEXT,
    published_at TIMESTAMPTZ,
    summary      TEXT,
    content      TEXT,
    image_url    TEXT,
    language     TEXT DEFAULT 'en',
    content_hash TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digest 快照
CREATE TABLE daily_digests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id     UUID NOT NULL REFERENCES pipeline_runs(id),
    items      JSONB NOT NULL,
    stats      JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 内容成稿
CREATE TABLE content_drafts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES pipeline_runs(id),
    digest_id       UUID REFERENCES daily_digests(id),
    title           TEXT,
    summary         TEXT,
    body_markdown   TEXT,
    body_html       TEXT,
    cover_url       TEXT,
    cover_media_id  TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 微信发布结果
CREATE TABLE wechat_publish_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id        UUID NOT NULL REFERENCES content_drafts(id),
    draft_media_id  TEXT,
    publish_mode    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.3 Redis 用途

| Key 模式 | 用途 | TTL |
|----------|------|-----|
| `wechat:access_token` | 微信 Token | ~6900s |
| `asynq:*` | 任务队列 | — |
| `dedup:url:{hash}` | 采集 URL 短期去重 | 24h |

---

## 7. API 设计

### 7.1 约定

- Base URL：`/api/v1`
- 鉴权：Header `X-API-Key: ${ADMIN_API_KEY}`
- 响应信封：

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

- 错误：`code != 0`，HTTP 4xx/5xx
- OpenAPI：Go 侧 `swaggo/swag` 或手写 `openapi.yaml` 放 `contracts/api/`

### 7.2 Pipeline（MVP 核心）

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/pipeline/runs` | 创建并异步执行 Run |
| `GET` | `/pipeline/runs` | 列表（分页，`?status=&limit=&offset=`） |
| `GET` | `/pipeline/runs/{id}` | Run 详情 + steps |
| `GET` | `/pipeline/runs/{id}/steps/{step}` | 单阶段 input/output |
| `POST` | `/pipeline/runs/{id}/cancel` | 取消（queued/running） |

**创建 Run 请求：**

```json
{
  "publish_mode": "draft_only"
}
```

**Run 详情响应（节选）：**

```json
{
  "id": "uuid",
  "status": "running",
  "current_step": "layout",
  "steps": [
    { "step": "collect", "status": "succeeded", "duration_ms": 4200 },
    { "step": "rank", "status": "succeeded", "duration_ms": 1800 }
  ],
  "digest_id": "uuid",
  "draft_id": null,
  "wechat_draft_media_id": null
}
```

### 7.3 内容查询

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/digests/{id}` | Digest Top 10 |
| `GET` | `/drafts/{id}` | 成稿（含 HTML 预览） |

### 7.4 系统

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/health` | 存活探针 |
| `GET` | `/health/ready` | 就绪（DB、Redis、llm-service） |
| `GET` | `/sources` | 数据源列表 |

### 7.5 异步执行模型

```
POST /pipeline/runs
  → INSERT pipeline_runs (queued)
  → asynq.Enqueue("pipeline:execute", runID)
  → 202 { run_id }

Worker:
  → UPDATE status=running
  → engine.Run(runID)
  → UPDATE status=succeeded|failed
```

前端轮询 `GET /pipeline/runs/{id}` 或 V1 加 SSE。

---

## 8. 前端架构（Vue 3）

### 8.1 页面（MVP）

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | `PipelineTrigger.vue` | 一键 Run、最近 Run 列表 |
| `/runs/:id` | `RunDetail.vue` | 步骤条、各阶段 JSON、错误信息 |
| `/drafts/:id` | `DraftPreview.vue` | HTML iframe 预览、草稿箱指引 |

### 8.2 目录结构

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # axios 实例 + 拦截器
│   │   └── pipeline.ts        # API 方法
│   ├── views/
│   ├── components/
│   │   ├── StepTimeline.vue
│   │   └── HtmlPreview.vue
│   ├── stores/
│   │   └── pipeline.ts        # Pinia
│   ├── router/index.ts
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 8.3 规范

- 全面 TypeScript，DTO 与 `contracts/api` 对齐
- 组件 `<script setup lang="ts">`
- API 错误统一 ElMessage 提示
- 不在前端存 Secret，仅调 Go API

---

## 9. 项目目录结构

```
auto_wechat_tech_content/
├── backend/                         # Go 主服务
│   ├── cmd/
│   │   ├── api/main.go
│   │   └── worker/main.go
│   ├── internal/
│   │   ├── config/                  # env 加载（viper / envconfig）
│   │   ├── domain/
│   │   │   ├── entity/
│   │   │   ├── port/
│   │   │   └── rule/                # 去重、排序降级
│   │   ├── application/
│   │   │   └── pipeline_service.go
│   │   ├── pipeline/
│   │   │   ├── engine.go
│   │   │   └── steps/               # collect.go, rank.go, ...
│   │   ├── infrastructure/
│   │   │   ├── mysql/               # repository
│   │   │   ├── redis/
│   │   │   ├── llmclient/           # HTTP → llm-service
│   │   │   ├── wechat/
│   │   │   ├── rss/
│   │   │   └── cos/
│   │   └── interface/
│   │       ├── http/                # Gin handlers
│   │       └── middleware/
│   ├── db/
│   │   ├── migrations/
│   │   └── queries/                 # sqlc SQL
│   ├── sqlc.yaml
│   ├── go.mod
│   └── Dockerfile
│
├── llm-service/                     # Python 薄 LLM 层
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── chains/
│   │   │   ├── registry.py
│   │   │   ├── ranker.py
│   │   │   ├── writer.py
│   │   │   └── layout.py
│   │   └── schemas/                 # Pydantic，对齐 contracts/llm
│   ├── prompts/
│   │   ├── ranker.yaml
│   │   ├── writer.yaml
│   │   └── layout.yaml
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/                        # Vue 3 SPA
│   └── ...
│
├── contracts/                       # 跨服务契约
│   ├── api/openapi.yaml
│   └── llm/*.schema.json
│
├── docs/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.development
├── .env.example
└── Makefile                         # dev / test / migrate 快捷命令
```

---

## 10. 工程规范与可维护性

### 10.1 Go 规范

| 项 | 规范 |
|----|------|
| 布局 | 标准 `cmd/` + `internal/`，禁止 `internal` 被外部 import |
| 错误 | `fmt.Errorf("context: %w", err)` 包装；领域错误 typed |
| 日志 | `slog` 结构化；每条带 `run_id`、`step` |
| 配置 | 启动时校验必填 env，缺项 fail fast |
| 测试 | 表驱动；domain/rule 100% 覆盖目标 |
| Lint | `golangci-lint` CI 必过 |

### 10.2 Python（llm-service）规范

| 项 | 规范 |
|----|------|
| 依赖 | `uv` 或 `poetry` 锁版本 |
| 类型 | 全面 type hints + Pydantic v2 |
| 禁止 | 数据库、微信、Pipeline 逻辑 |
| 测试 | 每个 chain 有 snapshot test（mock LLM） |

### 10.3 前端规范

| 项 | 规范 |
|----|------|
| Lint | ESLint + Prettier |
| 提交 | vue-tsc 无错误 |
| 组件 | 单文件组件；业务逻辑放 composables |

### 10.4 Git 与 CI（V1）

```
push → lint + test + build docker
main → 手动/自动部署 CVM
```

### 10.5 可观测性

| 项 | 实现 |
|----|------|
| Run 追踪 | `pipeline_run_steps.output_json` |
| 日志 | JSON 日志，按 `run_id` 检索 |
| 健康检查 | `/health/ready` 聚合 DB + Redis + llm-service |
| 指标（V1） | Prometheus：`pipeline_run_duration_seconds` |

---

## 11. 部署架构（腾讯云）

> 依赖清单见 [05-infrastructure-checklist.md](./05-infrastructure-checklist.md)

### 11.1 MVP Docker Compose

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `nginx` | nginx:alpine | 80, 443 | 反代 API + Vue 静态 |
| `api` | backend | 8080 | Gin HTTP |
| `worker` | backend | — | asynq worker |
| `llm-service` | llm-service | 8090（内网） | LangChain |
| `frontend` | 构建产物 | — | 静态文件挂 nginx |
| `mysql` | mysql:8.4 | 3306 | |
| `redis` | redis:7-alpine | 6379 | |

**MVP 不含：** Celery Beat、定时调度（V1 用 asynq Scheduler）

### 11.2 网络

```
Internet → nginx:443
              ├→ /api/*  → api:8080
              ├→ /*      → frontend static
              └→ llm-service 仅 internal network，不暴露公网
```

### 11.3 环境变量

Go 与 llm-service 共用 `.env.development`（Docker `env_file`）：

```bash
# 应用
ENV=development
ADMIN_API_KEY=
LOG_LEVEL=info

# 数据库
DATABASE_URL=mysql://wechat:pass@tcp(mysql:3306)/wechat_ai?parseTime=true&loc=UTC&charset=utf8mb4
REDIS_URL=redis://redis:6379/0

# LLM（llm-service 读取）
DASHSCOPE_API_KEY=
LLM_SERVICE_URL=http://llm-service:8090

# 微信
WECHAT_APP_ID=
WECHAT_APP_SECRET=

# COS（可选 MVP）
COS_BUCKET=
COS_REGION=ap-hongkong
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
```

### 11.4 演进路径

```
MVP   单机 Compose（香港 CVM 2C4G）
V1    + TencentDB + 云 Redis + COS + asynq 定时 Run
V2    Worker 独立节点 + 数据看板 + 企微告警
V3    CLB + 多 Worker 水平扩展（可选）
```

---

## 12. 安全

| 项 | 措施 |
|----|------|
| 密钥 | `.env.development` gitignore；生产用腾讯云 SSM 或环境注入 |
| API | 浏览器：**Session + HttpOnly Cookie**（Redis）；机器：`X-API-Key` — 详见 [08-auth-single-admin.md](./08-auth-single-admin.md) |
| llm-service | 仅内网访问；可选 shared secret header |
| 微信 | Token Redis 缓存；Secret 不入日志 |
| 爬虫 | 遵守 robots.txt；≤1 req/s/域 |
| 内容 | Reviewer + 来源标注；敏感词列表 |

---

## 13. 风险与对策

| 风险 | 对策 |
|------|------|
| llm-service 宕机 | Go Rank 降级规则排序；Review 跳过或人工 |
| 百炼限流 | 指数退避；fast/smart 模型分级 |
| 个人号 API 政策变化 | `PublishMode` 可切换 `copy_html` |
| Go/Python 契约漂移 | `contracts/llm` JSON Schema + CI 校验 |
| Pipeline 中途失败 | `pipeline_run_steps` 保留中间产物 |

---

## 14. 技术决策记录（ADR 摘要）

| # | 决策 | 结论 | 理由 |
|---|------|------|------|
| 1 | 主后端语言 | **Go** | 部署简单、并发好、长期维护成本低 |
| 2 | Pipeline 编排 | **Go 状态机** | 步骤固定；比 LangGraph 更可读 |
| 3 | LLM 集成 | **LangChain（Python 薄服务）** | Prompt/Parser 生态；与 Go 解耦 |
| 4 | 任务队列 | **asynq** | Go 原生，与 Worker 同栈 |
| 5 | DB 访问 | **sqlc** | SQL 显式、类型安全 |
| 6 | HTTP 框架 | **Gin** | 生态成熟、文档多 |
| 7 | 前端 | **Vue 3 + Element Plus** | 后台 SPA 场景匹配 |
| 8 | 云厂商 / 地域 | **腾讯云香港** | 外网 RSS + 微信 |
| 9 | 发布模式 MVP | **DRAFT_ONLY** | 草稿箱 API 已验证 |
| 10 | LLM 提供商 | **百炼 DashScope** | 已连通 |

---

## 15. 相关文档

- [01-prd-product-design.md](./01-prd-product-design.md) — 产品需求
- [03-implementation-roadmap.md](./03-implementation-roadmap.md) — 实施路线（待按 v1.0 栈更新）
- [04-operations-runbook.md](./04-operations-runbook.md) — 运维手册
- [05-infrastructure-checklist.md](./05-infrastructure-checklist.md) — 环境依赖
