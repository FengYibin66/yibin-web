# apps/auto-wechat/

微信公众号 AI 处理平台 `mpauto.yibinfeng.com`。Go 后端 + Vue 3 前端 + Python LLM 服务。

**本目录是仓库内后端分层的正确先例。**新增后端代码（含 portal 的改造）参照这里的结构，不要另创一套。

## 结构

```
backend/                 # Go + Gin
├── cmd/                 # 多入口，各自独立 main、可单独部署
│   ├── api/             # HTTP API 服务
│   ├── worker/          # 后台任务处理器（常驻）
│   ├── createadmin/     # 运维一次性命令
│   ├── hashpassword/
│   └── sync-layout-templates/
├── internal/
│   ├── domain/          # 业务核心：实体与规则。不感知 HTTP、不感知数据库
│   ├── application/     # 用例编排：组合 domain 能力完成一个业务动作
│   ├── infrastructure/  # 外部依赖的具体实现（DB、Redis、微信 API、LLM 调用）
│   ├── interface/       # 传输层适配：router + handler，把 HTTP 翻译成用例调用
│   ├── pipeline/        # 内容处理流水线
│   ├── worker/          # 任务消费逻辑
│   ├── config/
│   ├── textutil/ wechatarticle/
│   └── migrations/
frontend/                # Vue 3 + Vite
llm-service/             # Python FastAPI，封装 LLM 调用
contracts/               # 契约的唯一来源
├── api/openapi.yaml     # HTTP 接口契约
├── llm/                 # LLM 输出的 JSON Schema
├── illustrate/          # 配图流程的 schema
└── layout/              # 排版块 schema
few-shot/                # LLM few-shot 样例
media/                   # 媒体资源
```

## 分层规则（依赖方向单向朝内）

```
interface  →  application  →  domain
                  ↓              ↑
           infrastructure ───────┘（实现 domain 声明的接口）
```

- **`domain` 不 import 任何外层**，不感知 HTTP、SQL、Redis。它只有业务概念和规则
- **`infrastructure` 实现 `domain` 声明的接口**，由入口（`cmd/`）装配注入 —— 依赖倒置，`domain` 不知道 `infrastructure` 存在
- **`interface` 只做翻译**：解析请求 → 调 `application` 用例 → 序列化响应。不写业务规则
- **`cmd/` 只做装配**：读配置、构造依赖、注册路由、启动

违反方向的典型症状：`domain` 里出现 `gin.Context`、SQL 字符串、或 `net/http` 的 import。

## 为什么 `cmd/` 有多个入口

`api` 与 `worker` 分开是因为它们有**独立的负载轴**：API 是请求-响应型，worker 是长任务型，两者的扩缩与故障隔离诉求不同。`createadmin` 等是一次性运维命令，不需要常驻。

判定原则：**有独立轴（独立扩缩 / 独立技术依赖 / 故障隔离）才剥离入口**，否则加子命令。不要为每个功能建入口。

## 契约

`contracts/` 是契约来源。`llm/`、`illustrate/`、`layout/` 下的 JSON Schema 约束 LLM 的**输出结构**——这是让不确定的模型输出可被程序消费的关键，改 prompt 时同步检查 schema 是否仍然成立。

> **注意**：`contracts/api/openapi.yaml` 目前**没有接入代码生成**（前后端类型仍各自定义）。这是已知差距，不是"契约已生效"。若要接入生成，先写 ADR——参考 ADR 20260822120808 对 portal 的同类判断（契约形式要匹配消费端数量）。

## 命令

```bash
cd apps/auto-wechat
make dev-up          # 起 MySQL/Redis/API/worker 依赖
make dev-logs
make dev-down
make migrate-up
make health
make frontend-dev
go test ./...        # 在 backend/ 下，14 个测试文件
```
