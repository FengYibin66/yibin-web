# yibin_web Spec 索引

**原则**：`docs/specs/` 是产品与基础设施的权威来源；**行为变更先改 Spec，再改代码**。  
`config/`、`DEPLOYMENT.md`、各 app README 是操作手册，指向 Spec 而非重复规范。

---

## Spec 清单

| Spec | 内容 |
|------|------|
| **[platform.md](./platform.md)** | 环境变量、本地开发、生产部署（平台级，必读） |
| [portal-homepage.md](./portal-homepage.md) | Portal 主页（www.yibinfeng.com） |
| [portal-media.md](./portal-media.md) | Portal 媒体（头像/上传）— **MVP 本地，待升 COS+CDN** |
| [partner-api.md](./partner-api.md) | Partner 小程序 API — **Phase T www 分流** |
| [resume-site.md](./resume-site.md) | 交互式简历站 |
| [lab-corridor-complete-spec.md](./lab-corridor-complete-spec.md) | Resume `/lab` 走廊实现清单 |

**Auto-Wechat** 无独立 Spec 文件；产品与运维文档在 [`apps/auto-wechat/docs/`](../../apps/auto-wechat/docs/)，平台约束见 [platform.md §1、§4](./platform.md)。

---

## 非规范文档（调研 / 计划）

| 路径 | 用途 |
|------|------|
| `docs/research/` | 技术调研 |
| `docs/superpowers/` | 设计稿与分阶段计划 |

---

## 快速导航

| 我要… | 读 |
|-------|-----|
| 配 env / 本地开发 / 上 CVM | [platform.md](./platform.md) → `DEPLOYMENT.md`（生产命令） |
| 做 Portal / Resume / Lab | 上表应用 Spec |
| 做 Auto-Wechat 功能 | `apps/auto-wechat/docs/01-prd-product-design.md` 起 |

---

## 修改流程

1. 更新对应 Spec（含状态、日期）
2. 改代码 / `config/` / runbook
3. PR 引用 Spec 章节；验收勾选 Spec 中的 Criteria
