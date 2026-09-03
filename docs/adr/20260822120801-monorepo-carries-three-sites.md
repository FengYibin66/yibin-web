# 20260822120801. Monorepo 承载三站：部署耦合决定仓库边界

- 状态：已接受
- 索引：三站（portal / resume / auto-wechat）同仓，理由是共用一台 CVM、一份 nginx、一条 compose，部署耦合度高于代码耦合度；代价是 CI 需 path-based 过滤（尚未落地，见 20260822120807）
- 日期：2026-08-22

> 追认性 ADR：决策在 2026-07 monorepo 建立时已实际做出，本文补记理由与代价，使后续同类决策有据可循。

## 背景

`yibinfeng.com` 下有三个站点：portal（主站 + 管理后台）、resume（作品集）、mpauto（微信 AI 平台）。单人开发，三站共用一台腾讯云 CVM、同一份 `docker/nginx-prod.conf`、同一条 `docker-compose.prod.yml`、同一张 TLS 证书。

需要确定仓库边界。不决策的后果是随手拆仓，之后每次改 nginx 路由或加子域都要跨三个仓库开 PR 并手动对齐版本。

## 选项

- **A. 三个独立仓库**：各站边界清晰、可独立开源；但 nginx 配置、compose 编排、证书、环境变量模板这些**跨站共享的部署资产**没有归属地，只能再开第四个仓库或在某一个里放着让另两个引用。
- **B. Monorepo，三站在 `apps/` 下**：部署资产有唯一归属；一次 clone 一次 `pnpm install`；跨站改动（加子域、换证书、调 nginx）是一个原子 PR。代价是默认会全量构建。
- **C. 合并成单一应用多路由**：最省事，但 resume 是 Next.js SSG、auto-wechat 前端是 Vue、后端是 Go——技术栈不可能合并。

## 决策

选 **B**。判定原则：**部署耦合度高于代码耦合度时，用 monorepo**。

三站之间几乎没有代码复用（这一点上 A 更优），但它们共享整套部署面。仓库边界应该跟着**改动的原子性**走：一次"加一个子域"的改动必须同时改 nginx、compose、证书 SAN、DNS 说明，这四处若跨仓就无法原子提交，也无法在一个 PR 里 review 完整性。

推论（供后续参考）：将来若某个 app 的部署真正独立出去（自己的域名、自己的机器、自己的证书），那时它就该拆仓——**拆分线是部署面的边界，不是代码复用的边界**。

## 影响

- 正面：部署资产单一来源；跨站改动可原子提交与 review；本地一条命令起全部（`pnpm dev:all`）。
- 负面：默认全量构建。**当前 `.github/workflows/deploy.yml` 确实是全量构建三个 app**——改一行简历文案也会重建 portal 和 auto-wechat 前端。这是本决策的已知未偿代价，path-based 过滤见 ADR 20260822120807。
- 影响面：`apps/*`、`docker/`、`docker-compose.prod.yml`、`pnpm-workspace.yaml`。
