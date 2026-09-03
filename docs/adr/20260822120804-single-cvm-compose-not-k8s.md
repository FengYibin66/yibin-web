# 20260822120804. 单台 CVM + Docker Compose 编排，不上 K8s

- 状态：已接受
- 索引：生产是一台腾讯云 CVM 上的 docker compose，不引入 K8s / 托管容器服务；判定原则是「没有需要弹性的负载轴就不引入编排平台」
- 日期：2026-08-22

> 追认性 ADR。

## 背景

生产环境需承载：portal-server、auto-wechat-api、auto-wechat-worker、llm-service、MySQL、Redis、nginx 共 7 个容器，加 resume 的静态文件。单人运维，流量为个人站量级。

## 选项

- **A. Docker Compose 单机**：一条 `docker compose up -d` 起全部；运维面 = 一台机器 + 一个 compose 文件。无滚动更新、无自愈、单点。
- **B. K8s（自建或托管）**：滚动更新、健康检查自愈、水平扩缩；但需要控制面、清单管理（Kustomize/Helm）、镜像仓库策略，运维复杂度对单人是数量级上升。
- **C. Serverless / 托管 PaaS**：免运维；但 auto-wechat 有常驻 worker 和 Go+Python 多语言服务，且已有 CVM 沉没成本。

## 决策

选 **A**。判定原则：**没有需要弹性的负载轴，就不引入编排平台**（与「有独立轴才剥离服务」是同一条原则在基础设施层的应用）。

K8s 解决的是"多节点调度 + 弹性 + 自愈"，这三项的前提都是**负载有波动或规模超出单机**。个人站两项都不满足。在单节点上跑 K8s 得到的是全部复杂度、零收益。

## 影响

- 正面：运维面极小；本地 compose 与生产 compose 结构同构，可本地验证部署（`docker-compose.local-prod.yml`）。
- 负面：**单点故障**——机器挂了整站挂；**无滚动更新**，`up -d --build` 期间有秒级中断；无自愈，容器崩了要靠 restart policy。这三条对个人站是可接受损失，但要显式承认而不是假装不存在。
- 影响面：`docker-compose.prod.yml`、`DEPLOYMENT.md`、无 `deploy/` 或 `infra/` 目录（对比 EpicGlobal 有，因为它有真实的多环境与弹性诉求）。
