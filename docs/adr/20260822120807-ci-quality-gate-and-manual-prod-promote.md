# 20260822120807. CI 质量门禁前置，生产发布改为人工 promote

- 状态：已接受
- 索引：新增 `ci.yml` 在 PR 与 push 上跑 lint + test（path-based 过滤）；`deploy.yml` 去掉 `push: main` 自动触发，改为仅 `workflow_dispatch` 人工触发；部署与发布解耦
- 日期：2026-08-22

## 背景

改造前的 CI 只有一个 workflow：

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
```

其后续步骤是 build 三个 app → 推 Docker Hub → SSH 进 CVM 重启容器 → health check。

**全文件 grep `test` 与 `lint` 的命中项只有 `ubuntu-latest` 和 docker 镜像 tag 里的 `latest`——一次测试、一次 lint 都没跑。**

也就是说当前保障是：任何进入 main 的提交（包括 agent 生成的、未经测试的）会在数分钟内自动上线生产。而仓库里其实**有 50 个测试**（resume 31 + auto-wechat 19），只是从未在 CI 执行过。唯一的保护是作者不手抖 push main。

另有两处相关缺陷：

- `apps/portal/` 有 **0 个测试**，而它是唯一有后端和数据库写路径的 app
- 构建是全量的（改一行简历文案会重建 portal 与 auto-wechat 前端），这是 ADR 20260822120801 的未偿代价

## 选项

- **A. 保持现状**：零成本，零保障。
- **B. 加测试门禁，保留 main 自动部署生产**：拦住了明显破坏；但仍是「合入即上线」，任何通过测试却语义错误的改动会直接到达用户，且没有一个人工检查点。
- **C. 加测试门禁 + 生产人工 promote**：合入 main 只跑门禁与构建，上线由人显式触发。
- **D. C 再加 staging 环境**：最稳；但个人站没有独立环境的运维预算，且 `docker-compose.local-prod.yml` 已提供本地生产同构验证。

## 决策

选 **C**。判定原则：**部署与发布解耦；自动化负责「能不能上」，人负责「要不要上」**。

具体：

1. 新增 `.github/workflows/ci.yml`——在 PR 和 push 到任意分支时运行。用 path-based 过滤只跑受影响的 app（顺带偿还 ADR 20260822120801 的全量构建代价）。
2. `deploy.yml` **删除 `push: branches: [main]` 触发器**，只保留 `workflow_dispatch`。上线成为一个有意识的动作。
3. 回滚路径不变（重新部署上一个镜像），但现在它和正常发布是同一个人工入口，不需要临时想办法。

**不选 B 的理由**：这个仓库的主要代码产出者是 AI。AI 的失败模式不是"写出跑不过测试的代码"（那类门禁能拦），而是"写出跑得过测试但方向错了的代码"。对这类失败，唯一有效的检查点是人看一眼——而"合入即上线"恰好取消了这个检查点存在的时间窗。

**为什么不同时要求 portal 补测试到 70%**：那是另一个决策，且需要先有可测的分层（portal 现在是 `routes/` 直接调 `db/`，没有可单测的领域层）。本 ADR 只要求门禁**运行已有测试**，不设覆盖率闸门——设一个当前必然失败的闸门等于没有闸门。portal 的测试与分层作为独立事项跟踪。

## 影响

- 正面：50 个既有测试从"写了没跑"变成"每次 PR 都跑"；生产上线有人工检查点；path-based 过滤减少无关构建。
- 负面：上线多一步手动操作；**这是有意的摩擦**，不是缺陷。若将来觉得烦，正确的解法是补足自动化验收（E2E）而不是恢复自动部署。
- 影响面：新增 `.github/workflows/ci.yml`；修改 `.github/workflows/deploy.yml` 触发器；`DEPLOYMENT.md` 与 `README.md` 的发布说明需同步。
