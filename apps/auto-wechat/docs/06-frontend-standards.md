# 06 · 前端开发规范

> 文档版本：v1.0  
> 最后更新：2026-06-02  
> 适用范围：`frontend/`（Vue 3 + Vite + TypeScript）  
> **强制遵循**：[fyb-frontend-standards](/Users/tal/.cursor/skills/fyb-frontend-standards/SKILL.md)（universal + vue 层）

---

## 1. 规范来源与优先级

| 优先级 | 文档 | 说明 |
|--------|------|------|
| 1 | 本项目 PRD / 技术架构 | 业务与 API 约定 |
| 2 | fyb-frontend-standards · universal | 通用层（类型、API、数据驱动、安全） |
| 3 | fyb-frontend-standards · vue | Vue 3 SFC、模板、组合式 API |
| 4 | 本文档 | 本项目目录与命名补充 |

与 PRD、技术架构冲突时 **以项目文档为准**；不得违反 universal 安全网（类型、统一请求、无密钥硬编码）。

---

## 2. 技术栈

| 项 | 选型 |
|----|------|
| 框架 | Vue 3.4+ |
| 构建 | Vite 5+ |
| 语言 | TypeScript（strict） |
| 路由 | Vue Router 4 |
| 状态 | Pinia |
| UI | Element Plus |
| HTTP | axios（统一封装于 `src/api/request.ts`） |
| 样式 | Element Plus 主题 + 模块 scoped CSS（见 §7） |

**禁止：** React / Next.js、在视图层直接 `fetch`、在组件内硬编码 API Key。

---

## 3. 目录结构（强制）

```
frontend/src/
├── api/                    # HTTP 层，统一经 request.ts
│   ├── request.ts          # axios 实例、拦截器、错误码
│   ├── pipeline.ts         # Pipeline 域 API
│   ├── digest.ts
│   └── draft.ts
├── assets/
├── components/             # 跨页面通用 UI（PascalCase.vue）
│   ├── StepTimeline.vue
│   ├── HtmlPreview.vue
│   └── RunStatusTag.vue
├── composables/            # 复用逻辑（useXxx.ts）
│   ├── usePipelineRun.ts
│   └── usePolling.ts
├── constants/              # 全大写下划线、枚举映射
│   ├── pipeline.ts         # RUN_STATUS、STEP_LABELS
│   └── routes.ts
├── router/
│   └── index.ts
├── stores/
│   └── pipeline.ts         # Pinia：当前 Run、列表缓存
├── types/                  # 与 contracts/api 对齐
│   ├── pipeline.ts
│   └── api-common.ts
├── utils/
│   └── format.ts
├── views/                  # 页面（只做编排，≤300 行）
│   ├── PipelineTriggerView.vue
│   ├── RunDetailView.vue
│   └── DraftPreviewView.vue
├── App.vue
└── main.ts
```

业务块级 UI 放 `views/{module}/components/`，禁止堆在单页 500+ 行。

---

## 4. 单文件组件结构（强制，见 vue 层 §二）

```vue
<script setup lang="ts">
// 1. 引入
// 2. Props（defineProps）
// 3. Emits（defineEmits）
// 4. 路由 / Pinia
// 5. 常量
// 6. ref / reactive
// 7. computed
// 8. 函数（handleXxx、fetchXxx）
// 9. onMounted 等生命周期
// 10. watch
</script>

<template>
  <!-- 少逻辑，复杂判断用 computed -->
</template>

<style scoped lang="scss">
</style>
```

---

## 5. 数据流与 API（强制，见 universal §四）

- **Props down, emits up**；禁止子组件改 props
- 页面数据：**Pinia 或 composable** 拉取，不双份 state
- 所有请求经 `api/request.ts`：

```ts
// api/request.ts 职责
// - baseURL: import.meta.env.VITE_API_BASE_URL
// - Header: X-API-Key（来自 env，非硬编码）
// - 统一 { code, message, data } 解包
// - 业务错误 ElMessage；401/403 统一处理
```

```ts
// api/pipeline.ts 示例
import { request } from './request'
import type { PipelineRun, CreateRunPayload } from '@/types/pipeline'

export async function createPipelineRun(payload: CreateRunPayload): Promise<PipelineRun> {
  return request.post<PipelineRun>('/pipeline/runs', payload)
}
```

**禁止：** 在 `.vue` 里 `axios.post('http://...')`；忽略 `code !== 0`。

---

## 6. 类型与常量（强制）

- 禁止 `any`（极少数例外须注释）
- API 响应类型与 `contracts/api/openapi.yaml` 或后端 DTO 同步
- 状态、步骤名用常量，禁止魔法字符串：

```ts
// constants/pipeline.ts
export const RUN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS]
```

---

## 7. 模板与样式（强制）

| 规则 | 要求 |
|------|------|
| 复杂逻辑 | 用 `computed`，禁止模板内 `filter/map` 链 |
| 三元 | 非必要不用；禁止多层三元 |
| `v-for` | 必须 `:key="item.id"`（唯一 id，不用 index） |
| `v-for` + `v-if` | 禁止同元素；用 computed 列表或外层 template |
| HTML 预览 | **禁止**对不可信 HTML 使用 `v-html`；预览用 `iframe` + `srcdoc` 或 sandbox |
| 主题色 | 用 Element Plus CSS 变量，禁止写死 `#409eff` 等 |
| 样式优先级 | Token/主题 → Element 默认 → scoped 模块样式 → 内联（仅动态值） |

---

## 8. 页面职责（MVP）

| 视图 | 职责 | 主要 composable |
|------|------|-----------------|
| `PipelineTriggerView` | 一键 Run、最近列表 | `usePipelineRun` |
| `RunDetailView` | 步骤条、阶段 JSON、错误 | `usePolling(runId)` |
| `DraftPreviewView` | 成稿预览、草稿箱指引 | — |

页面 **≤300 行**；超出则拆 `components/`。

---

## 9. 异步与反馈（强制）

- 触发 Run：`loading` + 按钮 disabled
- 轮询 Run 状态：`usePolling`，组件卸载 `onUnmounted` 清定时器
- 空列表 / 失败 Run：**空态与数据一致**（ElEmpty / ElResult）
- 失败路径：不误关弹窗、不误刷新成功态列表

---

## 10. 环境变量

```bash
# frontend/.env.development
VITE_API_BASE_URL=http://localhost:8080/api/v1
# 鉴权：Session Cookie（withCredentials），见 08-auth-single-admin.md
```

仅 `VITE_` 前缀变量可在客户端使用；**微信 Secret 等永不进前端**。

---

## 11. 实现后检查清单

复制 fyb-frontend-standards 检查项，本项目额外项已合并：

```
- [ ] 已读 universal + vue 层
- [ ] 页面/组件 ≤300 行，api/工具 ≤500 行，函数 ≤30 行
- [ ] 模块化；重复已抽取 composables/components
- [ ] 无 any；无魔法值
- [ ] UI 数据驱动；Props down / emits up
- [ ] 空态/loading 与数据一致
- [ ] API 经 request.ts + 域模块；错误统一处理
- [ ] 预览 HTML 未使用不可信 v-html
- [ ] 无密钥硬编码；鉴权走 HttpOnly Cookie，不用 VITE_API_KEY
- [ ] vue-tsc + ESLint 无 error
- [ ] 与 PRD / OpenAPI 一致
```

Code Review 格式：**违规点 → universal/vue 条文 → 改法**。

---

## 12. 相关文档

- [02-technical-architecture.md](./02-technical-architecture.md) §8 前端架构
- [01-prd-product-design.md](./01-prd-product-design.md)
- fyb-frontend-standards：`~/.cursor/skills/fyb-frontend-standards/`
