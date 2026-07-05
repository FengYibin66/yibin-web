# 05 · 基础设施与依赖准备清单

> 文档版本：**v1.1**  
> 最后更新：2026-06-02  
> 云厂商：**腾讯云** · 地域：**香港**  
> 适用阶段：Phase 0 对齐 → MVP 上线

---

## 1. 一张图看懂要准备什么

```
你需要准备的东西，分三层：

┌─────────────────────────────────────────────────────────────┐
│  第一层：账号与资质（你本人注册/申请）                          │
│  腾讯云账号 · 域名 · 微信公众号 · LLM API · 企微机器人        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  第二层：腾讯云资源（在控制台购买/创建）                        │
│  CVM 服务器 · COS 对象存储 · [V1] TencentDB · [V1] Redis     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  第三层：应用内部组件（Docker 自动跑，MVP 不需单独买）          │
│  MySQL · Redis · Nginx · Go API · asynq Worker · Vue SPA │
└─────────────────────────────────────────────────────────────┘
```

**通俗解释：**

- **数据库（MySQL）**：存文章、Digest、Pipeline 运行记录。类似 Excel 的超级版，程序读写数据都靠它。
- **Redis**：临时缓存 + 任务队列。比如微信 Token 缓存、Pipeline 异步任务排队。
- **对象存储（COS）**：存图片（封面、新闻配图）。类似网盘，但通过 API 访问。
- **CVM**：云服务器，跑你的 Docker 容器。类似一台 24 小时开机的远程电脑。
- **LLM API**：Claude/GPT 等，Agent 的「大脑」。

---

## 2. 分阶段准备策略

| 阶段 | 策略 | 月成本约 |
|------|------|----------|
| **本地开发** | 全 Docker，零云费用 | ¥0 + LLM 调用费 |
| **MVP 上线** | 腾讯云香港 CVM + COS；DB/Redis 先放 Docker 里 | ¥150–350 |
| **V1 生产** | CVM + COS + TencentDB + 云 Redis + HTTPS | ¥350–600 |

**原则：MVP 少买托管服务，先跑通链路；稳定后再把数据库迁到 TencentDB。**

---

## 3. 完整依赖清单

### 3.1 必備（MVP 上线前必须有）

| # | 依赖 | 是什么 | 在哪里准备 | 用途 |
|---|------|--------|------------|------|
| 1 | **腾讯云账号** | 云平台账号 | [cloud.tencent.com](https://cloud.tencent.com) | 买服务器、COS |
| 2 | **CVM 云服务器** | 香港 2C4G，Ubuntu 22.04 | 腾讯云控制台 → 云服务器 | 跑 Docker 全部服务 |
| 3 | **COS 对象存储** | 存图片的「云盘」 | 控制台 → 对象存储 | 封面、配图、DB 备份 |
| 4 | **LLM API Key** | AI 模型接口密钥 | **阿里百炼 DashScope**（已验证）/ DeepSeek 等 | Ranker、Writer、排版专家 |
| 5 | **微信公众号** | 内容发布目标 | [mp.weixin.qq.com](https://mp.weixin.qq.com) | 草稿箱/发布 |
| 6 | **微信 AppID + AppSecret** | 公众号 API 凭证 | 公众号后台 → 开发 → 基本配置 | Publisher Agent 调用 |
| 7 | **域名**（推荐） | 如 `ai-news.example.com` | 腾讯云 DNSPod 或任意注册商 | HTTPS 访问后台 |
| 8 | **SSL 证书** | HTTPS 加密 | 腾讯云免费 SSL 或 Let's Encrypt | 安全访问 |
| 9 | **排版/写作范文** | 2–3 篇目标风格文章 | 你自己提供 | Agent Few-shot |

### 3.2 强烈推荐（MVP 建议有）

| # | 依赖 | 是什么 | 在哪里准备 | 用途 |
|---|------|--------|------------|------|
| 10 | **企业微信机器人 Webhook** | 群通知 URL | 企微群 → 添加机器人 | Pipeline 成功/失败通知 |
| 11 | **Git 仓库** | 代码托管 | GitHub / GitLab / 腾讯云 CODING | 部署、版本管理 |
| 12 | **安全组规则** | 防火墙 | CVM 控制台 → 安全组 | 只开放 80/443/22 |

### 3.3 可选（后期再加）

| # | 依赖 | 阶段 | 用途 |
|---|------|------|------|
| 13 | **TencentDB MySQL** | V1 | 托管数据库，自动备份 |
| 14 | **云数据库 Redis** | V1 | 托管缓存，高可用 |
| 15 | **Serper / Exa API** | V1 | 搜索补充，扩展资讯源 |
| 16 | **CLB 负载均衡** | V2 | 多实例、高可用 |
| 17 | **CDN** | V2 | 静态资源加速 |
| 18 | **腾讯云短信/邮件** | V2 | 告警通知备选 |

---

## 4. 腾讯云资源详细规划

### 4.1 CVM 云服务器（必买）

| 配置项 | MVP 推荐 | 说明 |
|--------|----------|------|
| 地域 | **香港** | 外网 RSS 采集稳定；访问微信 API 无问题 |
| 机型 | 标准型 S5 或轻量应用服务器 | 轻量更便宜，标准型更灵活 |
| 规格 | **2 核 CPU / 4GB 内存** | 跑 Docker Compose 够用 |
| 系统盘 | 50GB SSD | 系统 + Docker 镜像 |
| 操作系统 | **Ubuntu 22.04 LTS** | 文档和教程最多 |
| 带宽 | 5Mbps 按固定带宽，或按流量 | MVP 按流量更省 |
| 安全组 | 入站：22(SSH)、80(HTTP)、443(HTTPS) | 其余端口关闭 |

**安装软件（部署时一次性）：** Docker + Docker Compose

### 4.2 COS 对象存储（必买）

| 配置项 | 推荐 | 说明 |
|--------|------|------|
| 地域 | **香港**（与 CVM 同区） | 内网访问免流量费 |
| 存储桶 | 私有读写 | 如 `wechat-ai-125xxxxxx` |
| 存储类型 | 标准存储 | 封面/配图 |
| 目录规划 | 见下表 | — |

```
cos://wechat-ai-125xxxxxx/
├── covers/          # 文章封面
├── images/          # 正文配图
├── assets/          # 品牌 logo 等静态资源
└── backups/         # 数据库备份（V1）
```

**需要创建：**

- 存储桶 Bucket
- **子账号 + API 密钥**（SecretId / SecretKey）→ 写入 `.env`，不要给主账号 Key

### 4.3 MySQL 数据库

| 阶段 | 方案 | 说明 |
|------|------|------|
| **本地开发** | Docker 容器 `mysql:8.4` | 免费，数据在本地 |
| **MVP** | CVM 内 Docker 容器 | 不额外花钱，够用 |
| **V1** | **TencentDB for MySQL** | 自动备份、监控、省心 |

**TencentDB 规格（V1 参考）：**

| 配置 | 推荐 |
|------|------|
| 版本 | MySQL 8.0+ |
| 规格 | 1 核 2GB（入门） |
| 存储 | 20GB SSD |
| 网络 | 与 CVM 同 VPC，内网连接 |

**数据库里存什么：**

- 采集的原始文章、Top 10 Digest
- 内容草稿、发布记录
- Pipeline Run 日志（每次运行的状态）

### 4.4 Redis

| 阶段 | 方案 | 说明 |
|------|------|------|
| **本地 / MVP** | Docker 容器 `redis:7` | 免费 |
| **V1** | **腾讯云数据库 Redis** | 托管版 |

**Redis 用途（不需要你手动操作）：**

- **asynq** 任务队列（Pipeline 异步执行，Go Worker 消费）
- 微信 `access_token` 缓存（2 小时有效，避免频繁请求）
- 采集去重临时键

### 4.5 域名与 SSL

| 项 | 说明 |
|----|------|
| 域名 | 如 `pipeline.yourdomain.com` 指向 CVM 公网 IP |
| 备案 | **香港节点不需要 ICP 备案** |
| SSL | 腾讯云免费 DV 证书，或 CVM 上 certbot 自动续期 |
| 解析 | DNSPod 添加 A 记录 → CVM IP |

### 4.6 MVP vs V1 架构对比

```
【MVP — 一台 CVM 搞定】

  腾讯云香港 CVM (2C4G)
  ├── Docker: nginx + api(Go) + worker(asynq) + llm-service + frontend 静态
  ├── Docker: mysql           ← 数据库先放这里
  ├── Docker: redis           ← 缓存 + asynq 队列
  └── 连接 → COS 香港        ← 图片放云端

【V1 — 数据库拆出去】

  腾讯云香港 CVM
  ├── Docker: nginx + api + worker + llm-service + frontend
  ├── 内网连接 → TencentDB MySQL
  ├── 内网连接 → 云 Redis
  └── 连接 → COS 香港
```

---

## 5. 外部 API 与账号准备

### 5.1 LLM API（必选一个）

| 提供商 | 注册地址 | 推荐模型 | 用途 | 预估 MVP 月费 |
|--------|----------|----------|------|---------------|
| **阿里百炼** | [bailian.console.aliyun.com](https://bailian.console.aliyun.com) | qwen-plus（快）+ qwen-max（写） | **已验证，MVP 首选** | ¥50–200 |
| DeepSeek | platform.deepseek.com | deepseek-chat | 国产备选 | ¥30–100 |
| Anthropic | console.anthropic.com | Haiku + Sonnet | 备选 | ¥100–300 |

**建议：** MVP 用 **百炼 DashScope**（`DASHSCOPE_API_KEY`），由 `llm-service`（LangChain）统一调用。

### 5.2 微信公众号（必備）

> **2025 年起**：公众号的 AppSecret、IP 白名单等已从 `mp.weixin.qq.com` 的「开发接口管理」迁到 **[微信开发者平台](https://developers.weixin.qq.com)**。账号类型、认证状态仍在 **微信公众平台** 查看。

**已确认账号：**

| 字段 | 值 |
|------|-----|
| 原始 ID | `gh_aac33df75390` |
| AppID | `wxa4a9c7c1c88f920c` |

#### A. AppSecret + IP 白名单（微信开发者平台）

```
1. 打开 https://developers.weixin.qq.com ，微信扫码登录
2. 首页「我的业务」→ 点击「公众号」（你截图里显示：公众号 1）
3. 进入该公众号详情页
4. 左侧或顶部找「基础信息」→「开发密钥」
5. 若 AppSecret 未启用：点「启用」→ 扫码确认 → 复制保存（只显示一次）
6. 若已忘记：点「重置」生成新的（旧的会失效）
7. 同一页配置「API IP 白名单」
```

官方文档：[如何查看和重置 AppSecret](https://developers.weixin.qq.com/doc/oplatform/developers/dev/appid.html)

**启用 AppSecret 可能遇到的提示：**

| 提示 | 含义 | 处理 |
|------|------|------|
| 尚未完成**实名** | 个人主体，管理员未实名 | 微信公众平台 → 设置与开发 → 人员设置 → 管理员信息 |
| 尚未完成**主体认证** | 企业/组织未微信认证 | 微信公众平台 → 账号设置 → 申请微信认证 |

#### B. 账号类型 + 是否已认证（微信公众平台）

```
1. 打开 https://mp.weixin.qq.com ，扫码登录
2. 设置与开发 → 账号设置 → 账号详情
3. 查看：订阅号/服务号、微信认证状态
```

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | 注册公众号 | ✅ |
| 2 | 开发者平台 → 公众号 → 开发密钥 → 启用 AppSecret | ⏳ |
| 3 | 配置 IP 白名单 | ⏳ 部署时做 |
| 4 | 公众平台确认账号类型与认证 | ✅ 订阅号 / 个人 / 无法认证 |
| 5 | 开发者平台配置 IP 白名单 | ⏳ 见下方 IP |

**你需要告诉开发同学：**

- 账号类型（订阅号 / 服务号）
- 是否已认证
- 能否使用「草稿箱新增」API

### 5.3 企业微信机器人（推荐）

```
1. 建一个企微群（如「AI 公众号 Pipeline 通知」）
2. 群设置 → 添加群机器人 → 复制 Webhook URL
3. 写入 .env: WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

用于：Pipeline 跑完通知、失败告警。

### 5.4 搜索 API（可选，V1）

| 服务 | 用途 | 注册 |
|------|------|------|
| Serper | Google 搜索补充资讯 | serper.dev |
| Exa | 语义搜索 AI 内容 | exa.ai |

---

## 6. 环境变量对照表

部署时所有密钥集中在 `.env` 文件，**不入 Git**。

```bash
# ─── 腾讯云 ───
TENCENT_SECRET_ID=           # COS 子账号 SecretId
TENCENT_SECRET_KEY=          # COS 子账号 SecretKey
COS_BUCKET=wechat-ai-125xxxxxx
COS_REGION=ap-hongkong

# ─── 数据库（MVP: Docker 内部地址）───
DATABASE_URL=mysql://wechat:YOUR_PASSWORD@tcp(mysql:3306)/wechat_ai?parseTime=true&loc=UTC&charset=utf8mb4

# ─── Redis（MVP: Docker 内部地址）───
REDIS_URL=redis://redis:6379/0

# ─── LLM（llm-service 读取）───
LLM_SERVICE_URL=http://llm-service:8090
DASHSCOPE_API_KEY=           # 百炼 API Key
LLM_MODEL_FAST=qwen-plus
LLM_MODEL_SMART=qwen3.7-max
LLM_MODEL_LAYOUT=qwen3.7-max
LLM_MAX_OUTPUT_TOKENS_LAYOUT=32768

# ─── 微信公众号 ───
WECHAT_APP_ID=wxa4a9c7c1c88f920c
WECHAT_APP_SECRET=              # 写入 .env.development，勿提交 Git
WECHAT_ORIGINAL_ID=gh_aac33df75390

# ─── 通知 ───
WECOM_WEBHOOK_URL=

# ─── 应用 ───
ADMIN_API_KEY=               # 后台 API 鉴权，自行生成随机字符串
SECRET_KEY=                  # 应用加密密钥，自行生成
ENV=production
```

**V1 切 TencentDB 后只需改：**

```bash
DATABASE_URL=mysql://user:pass@tcp(10.x.x.x:3306)/wechat_ai?parseTime=true&loc=UTC&charset=utf8mb4
REDIS_URL=redis://:password@10.x.x.x:6379/0
```

---

## 7. 准备顺序（按这个来，不用一次全做完）

### Step 1：本地能跑（开发阶段，0 云费用）

- [ ] 安装 Docker Desktop（Mac/Windows）或 Docker（Linux）
- [ ] 注册 LLM API，拿到 Key
- [ ] `docker compose up` 本地启动（mysql、redis 都在容器里）
- [ ] 准备 2–3 篇写作/排版范文

### Step 2：腾讯云基础（MVP 上线）

- [ ] 注册腾讯云账号，实名认证
- [ ] 购买 **香港 CVM 2C4G**，Ubuntu 22.04
- [ ] 创建 **COS 存储桶**（香港）+ 子账号密钥
- [ ] 配置安全组：22、80、443
- [ ] SSH 登录 CVM，安装 Docker + Docker Compose
- [ ] 购买/解析 **域名** → A 记录指向 CVM IP
- [ ] 申请 **SSL 证书** 并配置

### Step 3：微信与通知

- [ ] 确认公众号类型与认证状态
- [ ] 获取 AppID、AppSecret
- [ ] CVM 公网 IP 加入微信 IP 白名单
- [ ] 创建企微群机器人，拿到 Webhook

### Step 4：部署应用

- [ ] Git 拉代码到 CVM
- [ ] 填写 `.env`（参照第 6 节）
- [ ] `docker compose -f docker-compose.prod.yml up -d`
- [ ] 访问 `https://pipeline.yourdomain.com` 验证
- [ ] 手动触发一次 Pipeline Run 测试

### Step 5：V1 加固（链路稳定后）

- [ ] 创建 **TencentDB MySQL**，迁移数据
- [ ] 创建 **云 Redis**，切换连接
- [ ] 配置 COS 自动备份
- [ ] 配置告警（企微）

---

## 8. 费用预估（腾讯云 MVP）

| 项目 | 规格 | 月费约 |
|------|------|--------|
| CVM 香港 2C4G | 按量或包月 | ¥80–150 |
| COS | 10GB 存储 + 少量流量 | ¥5–15 |
| 域名 | .com | ¥5–8（摊销） |
| SSL | 免费 DV 证书 | ¥0 |
| LLM API | 按 Pipeline 次数 | ¥50–200 |
| **合计** | | **¥140–370/月** |

V1 加 TencentDB + 云 Redis 约 **+¥150–250/月**。

---

## 9. 你不需要自己做的事

以下由代码 / Docker 自动处理，**不用单独购买或学习**：

| 组件 | 说明 |
|------|------|
| Nginx | Docker 容器，反向代理 `/api` + Vue 静态 |
| Go API / asynq Worker | 主后端 + Pipeline 编排，Docker 构建 |
| llm-service | Python FastAPI + LangChain，仅 LLM 调用 |
| Vue 3 SPA | 控制台前端，构建后由 Nginx 托管 |
| MySQL / Redis（MVP） | Docker 容器，自动启动 |
| 微信 Token 刷新 | Go 程序自动缓存到 Redis |
| 数据库表结构 | golang-migrate 迁移自动创建 |

---

## 10. Phase 0 交付物 Checklist

对齐会议前，请尽量准备好：

| 状态 | 项 | 负责人 |
|------|-----|--------|
| ☐ | 腾讯云账号已实名 | 你 |
| ☑ | 公众号 AppID | 你 |
| ☑ | 公众号 AppSecret（本地 `.env`） | 你 |
| ☑ | 订阅号 + 个人主体 + 无法认证 | 你 |
| ☐ | IP 白名单（开发者平台 → 开发密钥） | 你 |
| ☐ | LLM API Key 至少 1 个 | 你 |
| ☐ | 企微 Webhook URL | 你 |
| ☐ | 2–3 篇写作范文 + 1–2 篇排版标杆 | 你 |
| ☐ | 品牌主色 / 公众号名称 | 你 |
| ☐ | 域名（可 MVP 后再买） | 你 |
| ☐ | CVM + COS（开发完成后再买也可） | 你 |

---

## 11. 相关文档

- [01-prd-product-design.md](./01-prd-product-design.md) — 产品需求
- [02-technical-architecture.md](./02-technical-architecture.md) — 技术架构
- [03-implementation-roadmap.md](./03-implementation-roadmap.md) — 实施路线图
- [04-operations-runbook.md](./04-operations-runbook.md) — 运维手册
