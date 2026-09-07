# 平台路线图（2026-09-07 起草）

> **这是计划，不是决策。** 每一期动手前先写 ADR；下面标「待拍板」的项目在决定后改成指向 ADR 的链接。
> 起草背景：2026-09-07 梳理上线流程时发现的事实，见「现状」一节；对照物是 Epic Global
> 的交付体系（Terraform bootstrap / modules / environments、CI 无长期密钥、镜像按 sha、迁移由 CD 通道执行）。

## 现状（2026-09-07 实测，不是印象）

| 事实 | 依据 |
|------|------|
| 线上 `resume.yibinfeng.com` 是 **2026-07-12** 的构建；此后合入 main 的 **52 个提交没有上线** | 公网 `last-modified: 12 Jul 2026`；HTML 里没有 9 月加入的任何标记 |
| GitHub `deploy.yml` **从未成功**：7 月 12 日 6 次运行全失败，卡在 Docker Hub 登录（`DOCKER_USERNAME/PASSWORD` 未配） | Actions 运行记录 |
| `deploy.yml` 与 `docker-compose.prod.yml` **互相矛盾**：前者靠拉镜像 `--no-build`，后者的服务是 `build:`、静态站是本机目录 bind-mount——即使密钥配上也跑不通 | 两个文件对读 |
| **真实上线路径是人 SSH 到 CVM 跑 `scripts/deploy-prod.sh`**（拉代码 → 本机构建三个前端 → `compose up --build`），`docs/specs/platform.md §3.3` 把它定为规范 | 脚本与 spec |
| spec 写 CVM 从 **Gitee** clone，而仓库唯一 remote 是 GitHub；CVM 实际拉哪里未核实 | `platform.md:182` |
| 密钥是人在 CVM 上手填 `.env.shared.local` | `DEPLOYMENT.md` |
| 数据库迁移机制**是有的**：portal 用 Drizzle（`drizzle/0000_*.sql`，容器启动时执行）；auto-wechat 用 golang-migrate（`migrations/000001_init.up.sql`…） | 代码 |
| `Dockerfile.resume`（nginx 托管 `out/`）已写好但 compose 没用它 | `docker/` |

结论：CI 门禁（`ci.yml`）一直认真跑，**发布这一步从来是手工的，而且两个月没做过**。
根 `CLAUDE.md` 的「不手动部署、不手动改线上配置」是原则，至今没有机制。

## 计划 A：交付流水线与基础设施即代码

目标形态（缩到一台 CVM 的尺度，原则不缩）：

```
infra/                       Terraform（腾讯云 provider tencentcloudstack/tencentcloud）
├── bootstrap/               tfstate 桶（COS）+ GitHub OIDC 身份（CAM 角色，assume_role_with_web_identity）
└── environments/prod/       import 现有 CVM、安全组、DNSPod 记录、证书；不重建任何东西
.github/workflows/
├── infra.yml                PR → terraform plan；main → apply
└── cd.yml                   构建 4 个镜像（tag = git sha）→ 推腾讯 TCR →
                             SSH 到 CVM → 从 GitHub Environment secrets 生成 .env →
                             compose pull && up（migrate 先跑、挡住后面）→ 健康检查 → 公网探针
docker-compose.prod.yml      全部 image: 引用；不再有 build: 与本机目录挂载
```

三条原则性变化：**CVM 上不再有 git checkout、不再有人手填 env、不再有人跑脚本**。
它只是一台跑 compose 的机器，一切来自 CD。Gitee 的问题随之消失（CVM 不需要代码）。

腾讯云支持 EG 同款的免密钥模式：provider 的 `assume_role_with_web_identity` + GitHub 侧 OIDC Action
（[provider 文档](https://registry.terraform.io/providers/tencentcloudstack/tencentcloud/1.81.190/docs)、
[Authenticate to Tencent Cloud](https://github.com/marketplace/actions/authenticate-to-tencent-cloud)、
[terraform-tencentcloud-cam](https://github.com/terraform-tencentcloud-modules/terraform-tencentcloud-cam/blob/main/README.md)）。

### 分期

| 期 | 内容 | 产出 |
|----|------|------|
| 1 | **让 `deploy.yml` 真的能跑**：四个镜像化、compose 改 `image:`、CD 推 TCR + SSH 拉起、env 由 secrets 生成、迁移显式一步、健康检查 | 52 个提交上线的最短路径 |
| 2 | Terraform 第一期：bootstrap + import 现有资源 + OIDC 身份；`infra.yml` | 基础设施有代码描述、有 plan 可看 |
| 3 | 同机 staging（另一组端口 + 子域名），main 自动上 staging、prod 手动提升 | EG 的 test 环境，零成本 |

### 与现有 ADR 的关系

- [ADR 20260822120804](../adr/20260822120804-single-cvm-compose-not-k8s.md)（单机 compose、不上 K8s）**不变**。
- [ADR 20260822120807](../adr/20260822120807-ci-quality-gate-and-manual-prod-promote.md)（人工触发上线）——
  第 1 期落地时决定是保留人工点一下（点了之后全自动），还是 main 自动上线 + 一键回滚。**待拍板**。

### 待拍板（决定后改成 ADR 链接）

1. push main 自动上线，还是保留人工触发？
2. 要不要同机 staging？
3. 镜像仓库：腾讯 TCR 个人版（免费、CVM 拉取快）vs GHCR（大陆拉取慢）。建议 TCR。
4. Terraform 第一期范围：建议只 import 不重建。

## 计划 B：统一控制台 `console`

### 起因

需求：门户页（`/`）首访放欢迎动效 → 最多三题的表单收集访客信息 → 我能在后台看数据。

约束：resume 站是静态导出（[ADR 20260822120803](../adr/20260822120803-resume-ssg-no-runtime-backend.md)），
不能收数据；必须有一个后端进程。备选：放 portal（已有库、登录、后台）/ 新起应用 / 第三方表单。

用户方向：**新起一个后台应用，并把 portal 的内容管理也收进去，成为唯一控制台**；portal 退化为纯展示站。
理由：两个后台两套登录不可接受；"内容管理"与"观测/运营"混在一张 Dashboard 里边界不清；
新后端可按 `auto-wechat/backend` 的四层分层写，给 portal（已登记的分层负债）立样板。

### 形态（建议，待 ADR）

| 项 | 建议 |
|----|------|
| 位置 | `apps/console/`，`console.yibinfeng.com` |
| 后端 | Go + Gin，domain / application / infrastructure / interface 四层（仓库唯一正确先例） |
| 存储 | 自己一份 libSQL/SQLite；与 portal 不共享（仓库红线） |
| 前端 | React + Vite |
| 收数入口 | `POST /api/events`（匿名访问事件）+ `POST /api/visitors`（表单）；蜜罐 + 限速 |
| 分期 | ① 访客事件与表单 + 后台列表；② 迁入 portal 的资料 / 项目管理；③ portal 变纯展示（可静态化） |

### 产品层待拍板

1. 烟花只首次还是每次（建议只首次，回访显示「欢迎回来」；尊重 `prefers-reduced-motion`）
2. 三题内容（建议：称呼 / 身份单选 / 最想看什么单选，第三题可用于直达对应内容）
3. 必须能跳过；跳过也记匿名事件
4. 要不要匿名自动记访问事件（回答"多少人"）
5. 有人填表是否即时通知

### 依赖

计划 B 的后端要上线，依赖计划 A 第 1 期（否则又是一个只能手工部署的服务）。**先 A1，再 B1。**

## 已知的文档漂移（顺手登记）

- `docs/AGENTS.md` 与根 `CLAUDE.md` 都列了 `docs/architecture/`，2026-09-07 之前它不存在。
- `docs/specs/platform.md §3.3` 的「Gitee clone」与仓库 remote 不一致，待核实 CVM 实际来源。
- `deploy.yml` 顶部注释描述的流程从未跑通过；第 1 期落地时一并改写。
