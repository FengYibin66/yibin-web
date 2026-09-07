# yibin-web — 项目基础

## 项目背景

`yibinfeng.com` 的个人站点集合，单人开发 + AI 协作。三个独立应用同仓，共用一台腾讯云 CVM、一份 nginx、一条 compose（同仓理由见 ADR 20260822120801）。

| 应用 | 域名 | 职责 |
|------|------|------|
| portal | www.yibinfeng.com | 主站 + 内容管理后台 |
| resume | resume.yibinfeng.com | 作品集 / 简历（3D 场景） |
| auto-wechat | mpauto.yibinfeng.com | 微信公众号 AI 处理平台 |

## 技术栈

| 部分 | 技术 | 构建 |
|------|------|------|
| portal client | React 19 + Vite + TypeScript | vite |
| portal server | Hono + TypeScript + Drizzle | tsc |
| portal 持久层 | **libSQL（SQLite 兼容）单文件** — 不是 MySQL，见 ADR 20260822120802 | — |
| resume | Next.js 15 SSG（`output: 'export'`）+ React Three Fiber | next build |
| auto-wechat backend | Go + Gin | go build |
| auto-wechat frontend | Vue 3 + Vite | vite |
| auto-wechat llm-service | Python + FastAPI | — |
| 共享存储 | MySQL 8.4 + Redis 7（**仅 auto-wechat 使用**） | — |
| 包管理 | pnpm 10.22 workspace | — |

## 仓库结构

```
apps/
├── portal/              # 主站 + 后台
│   ├── client/          # React SPA
│   └── server/          # Hono API（routes/ + db/，尚无领域层——见下「已知负债」）
├── resume/              # Next.js SSG 静态站，无运行时后端（ADR 20260822120803）
└── auto-wechat/         # 微信 AI 平台
    ├── backend/         # Go：cmd/ 多入口 + internal/{domain,application,infrastructure,interface}
    ├── frontend/        # Vue 3
    ├── llm-service/     # Python FastAPI
    └── contracts/       # OpenAPI + LLM 输出的 JSON Schema
config/                  # 环境变量模板（*.example），生成 .env.* 见 scripts/env-build.sh
docker/                  # nginx 配置 + Dockerfile
docs/
├── adr/                 # 架构决策记录（制度见 ADR 20260822120805）
├── architecture/        # 架构现状与设计
├── specs/               # 功能规格
├── reviews/             # 验收报告
└── research/            # 技术调研
scripts/                 # 部署、环境构建、文档索引生成
.claude/hooks/           # AI 机制门禁（ADR 20260822120809）
```

**每个有约定的目录放一份中文 `AGENTS.md`**（制度见 ADR 20260822120806）：

- **操作任一目录下的文件前，先读该目录的 `AGENTS.md`**；没有则向上找最近的一份
- 新建有约定的目录时同步补建，目录职责变化时在同一次改动里更新
- 根目录不放 `AGENTS.md`，以本文件为准（避免两个事实来源）

## 架构边界

### 应用之间

三个 app **不共享代码，也不共享持久层**。portal 与 auto-wechat 各有独立数据库，任何跨应用的数据需求走接口，不走数据库（ADR 20260822120802）。

`packages/` 不存在——曾有一个空目录，因从未有过真实共享代码而删除。若将来确有跨 app 共享需求，先写 ADR 说明为什么不能各自持有。

### 分层

**`auto-wechat/backend` 是本仓库分层的正确先例**：`cmd/` 多入口 + `internal/` 分 `domain`（业务核心）/ `application`（用例编排）/ `infrastructure`（外部依赖实现）/ `interface`（传输层适配）。依赖方向单向朝内，`domain` 不感知 HTTP 与数据库。

新增后端代码按此结构组织。**portal server 目前不符合**（见下「已知负债」）——它是待对齐的一方，不要以它为范例。

### 契约

- portal：接口类型由 `apps/portal/server/src/db/schema.ts` 经 Drizzle `$inferSelect` 派生，**禁止手写重复定义**（ADR 20260822120808）
- auto-wechat：`contracts/` 下的 OpenAPI 与 JSON Schema 是契约来源

## 已知负债

> **这一节写的是当前实现与目标架构的差距，每条都有对应 ADR 或跟踪项。它们是已登记的负债，不是等待你顺手修复的缺陷——改动前先确认在你这次任务范围内。**

| 负债 | 现状 | 依据 |
|------|------|------|
| portal 无领域层 | `routes/` 直接调 `db/`，业务逻辑在 handler 里 | 应对齐 auto-wechat 分层；尚无 ADR，动手前先写 |
| portal 测试覆盖仍偏薄 | server 98 个（认证攻击面 / 路由权限 / 库侧 CHECK / 上传 / 档案 / 类型派生），client 52 个（仅工具函数，无组件测试） | 暂不设覆盖率闸门，先让门禁跑起来（ADR 20260822120807） |
| **全仓 lint 实际不可用** | portal：`client` 的 `lint` 写着 `eslint src` 但**无 eslint 依赖、无配置文件** → `command not found`。resume：`eslint.config.mjs` 按 flat config 写，装的 `eslint-config-next@15.5.20` 导出旧版 eslintrc 对象 → `nextVitals is not iterable`。**两处都是从未跑通过**，CI 刻意不跑（跑必然失败的步骤只会训练人忽略红灯） | 修它是一次独立的依赖升级决策，需先写 ADR。portal 侧要补依赖 + config；resume 侧要么升 `eslint-config-next` 到导出 flat config 的版本，要么把配置改回 eslintrc 形态。改完把 `ci.yml` 的对应步骤加回来 |
| CI 全量构建 | 改一行简历文案也重建 portal 与 auto-wechat 前端 | ADR 20260822120801 的未偿代价，ADR 20260822120807 用 path 过滤部分偿还 |
| 单点故障 | 一台 CVM，无滚动更新、无自愈 | ADR 20260822120804 显式接受 |
| resume 纹理加载瀑布 | `ProjectsRoom` 每张卡无条件声明 26 个纹理 loader（其余 3 条 P1 已修，见 `apps/resume/AGENTS.md` 的状态表） | 报告 `docs/reviews/2026-07-12-resume-lab-room-audit.md` **已陈旧**，以 AGENTS.md 为准 |

## 分支与发布

- **Trunk-based**：`main` 是唯一长期分支。分支从 `main` 切、合回 `main`，命名 `feat/<scope>-<desc>` / `fix/<scope>-<desc>`
- **PR squash 合入**，标题遵循 Conventional Commits
- **CI 门禁**（`.github/workflows/ci.yml`）：PR 与 push 触发，跑受影响 app 的 lint + test
- **生产发布是人工动作**（`deploy.yml` 仅 `workflow_dispatch`）：合入 main **不会**自动上线。理由见 ADR 20260822120807——AI 的典型失败是「跑得过测试但方向错」，人工检查点是唯一防线
- 回滚 = 重新部署上一个镜像；git 上只 `git revert`，不强推

## 测试策略

新代码先写测试再写实现。CI 跑全部已有测试，暂不设覆盖率闸门（ADR 20260822120807）。

| 位置 | 数量 | 内容 |
|------|------|------|
| `apps/resume/__tests__/` | 1230（80 文件） | 组件与逻辑单测（vitest） |
| `apps/resume/e2e/` | 146（73 spec ×2 形态） | Playwright E2E（chromium + mobile-safari）：静态导出形态 + Lab 的行为（进房 / 退房 / 传送 / ESC / 面板 / 教程 / 语言切换）+ Classic 滚动显形的全部进入路径。Lab 那批的五个坑见 `apps/resume/AGENTS.md` |
| `apps/portal/server/__tests__/` | 98 | 认证攻击面、路由权限、库侧 CHECK、上传（存储型 XSS 防线）、档案、CORS、类型派生 |
| `apps/portal/client/__tests__/` | 52 | 脏数据解析、保存/登录错误分类 |
| `apps/auto-wechat/backend` | 14 文件 | Go 单测 |
| `.claude/hooks/tests/` | 75 | 门禁脚本回归（含 push-main 各种绕过形态） |
| `scripts/ci/gate-test.sh` | 14 | 门禁汇总逻辑 |
| `scripts/ci/lint-workflows.py --self-test` | 10 | workflow 接线检查 |
| `scripts/docs/test_gen_docs_index.py` | 29 | ADR 索引生成器 |

| 代码类型 | 测试方式 |
|----------|----------|
| 业务逻辑、数据访问 | 单测先行 |
| 认证 / 权限 | 必须有**攻击用例**（伪造凭据、越权访问），并做变异测试确认用例真能抓到漏洞——见 ADR 20260822132001 的验证一节 |
| 数据库约束 | 用**裸 SQL** 断言，绕过 ORM 的类型层。只走 ORM 测不出约束到底在哪一层（ADR 20260822120808 曾因此写错结论） |
| 外部集成（微信回调、LLM 调用、CDN） | 集成测试 + 契约测试 |
| UI / 3D 交互 | 组件测试（vitest）；关键路径 E2E |
| 门禁脚本 / 生成器 | 必须有回归测试——它们静默失效时没有症状，只有下一次事故 |

## AI 协作硬约束

以下是红线。标注 **[机制]** 的由 `.claude/hooks/` 拦截，其余靠 review 与 CI。

- **[机制] 不直接 push `main`**，一律走 PR
- **[机制] 不用 `git --no-verify`** 绕过检查
- **[机制] 不硬编码 secret**（API key、密码、token、证书私钥）
- **[机制] 不手改派生产物**（由 schema 派生的类型出口、生成的索引表）
- **不手动部署、不手动改线上配置**：部署走 `deploy.yml`，配置在仓库内
- **不手写可派生的代码**：portal 接口类型改 schema 后重新派生（ADR 20260822120808）
- **架构决策先写 ADR 再实现**：有备选方案的选择必须落 ADR，且**设计与实现分开提交**——设计评审回答「要不要这么做」，代码评审回答「有没有做对」
- **`AGENTS.md` 必须与目录内容同步**：目录职责变化在同一次改动里更新
- **`docs/adr/AGENTS.md` 的索引表是生成物**：改完 ADR 头部 `状态：`/`索引：` 字段后运行 `python3 scripts/docs/gen_docs_index.py`，不手改表体
- **ADR 不可变**：决策变了新写一份并在旧 ADR 追加前向指针，不重写正文

## 常用命令

```bash
pnpm setup                # 安装依赖
pnpm dev:all              # 同时起 portal / resume / auto-wechat 前端
pnpm dev:portal           # 仅 portal
pnpm dev:resume           # 仅 resume（:3000）
pnpm lint                 # 全仓 lint（-r，缺 lint script 的包会跳过）

pnpm --filter @yibin/resume test               # resume 单测（vitest）
pnpm --filter @yibin/resume build              # E2E 前置：先出静态产物
pnpm --filter @yibin/resume test:e2e           # resume E2E（Playwright）
pnpm --filter @yibin/portal-server test        # portal 后端测试
pnpm --filter @yibin/portal-server type-check  # 含类型层测试（@ts-expect-error 探针）
cd apps/auto-wechat && make dev-up             # 起后端依赖（MySQL/Redis/API/worker）

bash .claude/hooks/tests/test-hooks.sh         # 门禁 hooks 回归
bash scripts/ci/gate-test.sh                   # CI 汇总门禁逻辑
python3 scripts/docs/test_gen_docs_index.py    # ADR 索引生成器单测
python3 scripts/docs/gen_docs_index.py         # 重新生成 ADR 索引
python3 scripts/docs/gen_docs_index.py --check # 校验索引同步（CI 用）
./scripts/env-build.sh production --check      # 校验生产环境变量完整
```

## 文档诚实性

**本文件描述的是已批准的设计与当前已知的现状。发现本文与实现不一致时，先判断哪一侧是对的，不要默认本文正确**——本仓库已经因此栽过一次：`docs/ARCHITECTURE.md` 长期写「Portal & Auto-Wechat share MySQL」，而实现从来是 libSQL 单文件，直到 ADR 20260822120802 才纠正。基于错误前提的连锁设计比文档不整洁的代价高得多。

改动前若本文与目标文件冲突，**以目标文件的当前内容为准**，并在同一次改动里修正本文或提出 ADR。
