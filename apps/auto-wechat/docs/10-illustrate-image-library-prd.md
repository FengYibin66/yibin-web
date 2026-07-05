# 10 · 配图环节与图片库（PRD）

> 文档版本：**v0.2**  
> 状态：**待开发**  
> 关联：[01-prd-product-design.md](./01-prd-product-design.md) · [09-wechat-layout-methodology.md](./09-wechat-layout-methodology.md) · [contracts/illustrate/README.md](../contracts/illustrate/README.md)  
> 前置决策：暂不 COS；一新闻一配图槽位；刊头/导语/SVG 为排版代码，不归配图

---

## 1. 目标与边界

### 1.1 要解决什么

在 **writer → layout** 之间插入 **`illustrate`（配图）**，并为运营提供：

1. **可视化**：每条新闻对应一张图，成功后一览对照  
2. **可干预**：单条换图（重新自动配图 / AI 重生 / 本地上传 / 从图片库选取）  
3. **可复用**：图片库沉淀生成、抓取、上传的好图，跨 Run 复用  

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **当期优先** | 图先绑在 Run 内槽位；进库是附加动作，不阻断当期 publish |
| **一新闻一图** | 槽位数 = 资讯条数；不在单条下堆多张 |
| **生动不堆砌** | 无板块氛围图、无装饰图（MVP）；刊头/SVG 归 layout 代码 |
| **默认可沉淀** | AI 默认自动入库；抓取/RSS 偏手动，防图库灌水 |
| **落盘即资产** | 进库必须落盘（`/public/media/`），不只存外链（外链会失效） |
| **发布再转微信** | 编辑期任意 HTTPS；`publish` 统一 `uploadimg`（jpg/png、≤1MB） |

### 1.3 不做什么（MVP）

| 不做 | 原因 |
|------|------|
| 刊头 / 导语 / SVG 配图槽位 | 属 layout 代码，非位图 |
| COS 转存 | 当前阶段暂不配置；见 §6 |
| 每条新闻多张图 | 违反「一新闻一图」 |
| 前端直调微信 `uploadimg` | 官方要求仅服务端 |
| 第三方免费图床 | 不稳、防盗链、合规风险 |

---

## 2. 流水线

### 2.1 步骤顺序

```
collect → rank → enrich → editor → writer
    → illustrate（配图）【新增】
    → layout → review → cover → publish
```

### 2.2 职责矩阵

| 步骤 | 产出 | 与图的关系 |
|------|------|------------|
| **illustrate** | `IllustrationOutput` | 每条资讯 1 槽位 + 可选 `assetId` |
| **layout** | `bodyHtml` | 把槽位图写入模板/figure；刊头 SVG 仍是代码 |
| **cover** | `thumb_media_id` | 列表封面，与正文配图独立 |
| **publish** | `draft_media_id` | 正文 `<img>` → `uploadimg`；封面 `UploadThumb` |

### 2.3 Regenerate 级联

| 从哪步 regenerate | 失效并重跑 |
|-------------------|------------|
| `illustrate` | illustrate → layout → review → cover → publish |
| 单槽操作（PATCH/regenerate slot） | **仅** illustrate output；layout **不**自动重跑，UI 提示用户确认 |
| `layout` | layout 及下游 |

与现有 `pipelineSteps.ts` / `Invalidate*` 对齐，在 `writer` 与 `layout` 之间插入 `illustrate`。

---

## 3. 配图自动逻辑（瀑布）

每条资讯独立走：

```
① RSS article.imageUrl（下载 + 尺寸 + 相关性）
        ↓ 未通过
② OG / 页面首图抓取
        ↓ 未命中
③ AI 生成（Wanx，与 cover 同通路）
        ↓ 失败
④ status=failed（layout 该条无图，不阻断）
```

**AI 调用次数** = ③ 触发次数，无固定「每期 3 张」上限。

### 3.1 相关性（MVP 简化）

| 层级 | 规则 |
|------|------|
| P0 | RSS 图可下载且宽≥400px 即采纳；AI prompt 含 headline + section |
| P1 | LLM 对「标题+摘要 vs 图片 alt/文件名」打 `relevanceScore`，<0.6 不采纳 |

---

## 4. 数据模型（两层）

```
IllustrationSlot（Run 内，一期）
    image.url         ← 当期 layout/publish 用的 URL（快照）
    image.assetId?    ← 若已关联图片库
         │
         ▼
ImageAsset（全局图片库，跨 Run）
    url, contentHash, source, provenance, usageCount, ...
```

**要点：**

- 换图只改 slot；历史 Run 的 `step.output` 不回写  
- 进库后 slot 挂 `assetId`；`url` 与 asset.url 一致（或快照副本）  
- 从库选图：PATCH slot `{ assetId }`，`source=library`，`usageCount++`

---

## 5. 契约摘要

完整 JSON Schema 见 [contracts/illustrate/](../contracts/illustrate/README.md)。

### 5.1 `IllustrationOutput`（step output）

```json
{
  "planVersion": "v1",
  "slots": [{
    "id": "news_1",
    "role": "news_thumbnail",
    "bindTo": {
      "sourceUrl": "https://原文",
      "headline": "标题",
      "section": "大模型",
      "rank": 1
    },
    "image": {
      "assetId": "uuid-or-null",
      "inLibrary": true,
      "url": "https://.../public/media/uuid",
      "source": "generated",
      "originUrl": "https://百炼临时或外站",
      "relevanceScore": 0.85,
      "prompt": "仅 generated"
    },
    "status": "ready",
    "errorMessage": null
  }],
  "stats": { "total": 10, "ready": 9, "failed": 1, "inLibrary": 5 }
}
```

`inLibrary`：冗余字段，便于 UI 显示 ★，与 `assetId != null` 等价。

### 5.2 `ImageAsset`（图片库）

```json
{
  "id": "uuid",
  "name": "大模型-某某发布-配图",
  "url": "https://.../public/media/uuid",
  "storage": "local_volume",
  "source": "generated | upload | rss | og | scraped",
  "originUrl": "可选",
  "prompt": "仅 generated",
  "mimeType": "image/jpeg",
  "byteSize": 98234,
  "width": 800,
  "height": 450,
  "contentHash": "sha256...",
  "tags": ["大模型"],
  "provenance": {
    "firstRunId": "uuid",
    "firstSlotId": "news_3",
    "headline": "首次关联的资讯标题"
  },
  "usageCount": 3,
  "autoIngested": true,
  "deletedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**`name` 默认：** `{section}-{headline 前 20 字}-{source 标签}`，图库内可改。

### 5.3 layout LLM 输入

```json
{
  "writer": {},
  "editor": {},
  "illustrations": {
    "slots": [],
    "bySourceUrl": { "https://原文": "https://配图url" }
  },
  "templates": []
}
```

Layout 约束补充：**不得修改** `illustrations` 已绑定的 URL；有绑定则在对应 `news_item` 输出 `figure` / `<img>`。

---

## 6. 图片 URL 策略（无 COS）

### 6.1 三阶段

| 阶段 | URL | 说明 |
|------|-----|------|
| 配图/编辑 | `/public/media/{id}` 或外链 | 需 `PUBLIC_API_BASE_URL`（ngrok/正式域） |
| 发布 | `mmbiz.qpic.cn` | `uploadimg`，jpg/png、≤1MB |
| P2 | COS | 替换 `local_volume` |

### 6.2 本地上传（MVP 默认）

```
POST /media/upload (multipart)
  → 校验 jpg/png、≤1MB（与 uploadimg 前置一致）
  → 落盘 media/assets/{id}.ext
  → ImageAssetService.Ingest(...)
  → 返回 asset.url
```

勾选「同时加入图片库」时 `source=upload`；未勾选仅绑定 slot、可不建 asset（P0 建议**默认勾选**）。

### 6.3 百炼 AI 临时 URL

illustrate 生成后 **立即下载落盘** 再写 slot.url，**禁止**把百炼临时链直接长期写入 slot（会过期）。

---

## 7. 图片库 · 入库设计（核心）

### 7.1 统一入口 `ImageAssetService.Ingest`

所有进库路径走同一函数：

```go
Ingest(ctx, IngestInput{
  Bytes []byte
  Source string          // generated|upload|rss|og|scraped
  OriginURL string
  Prompt string
  RunID, SlotID, Headline, Section string
  Tags []string
  AutoIngested bool
}) (asset ImageAsset, created bool, err error)
```

流程：

1. 计算 `contentHash = sha256(bytes)`  
2. 查库：hash 已存在 → `usageCount++`，返回已有 asset（`created=false`）  
3. 否则写磁盘 + INSERT `image_assets`（`created=true`）  
4. 回写 slot `assetId`、`inLibrary=true`

### 7.2 自动 vs 手动入库（定稿）

| 来源 | 自动入库 | 手动入库 |
|------|----------|----------|
| **AI 生成** | ✅ 默认开（illustrate 成功即 Ingest） | 对照表「加入图片库」（已入库则提示） |
| **RSS** | ⚠️ P1：仅 `relevanceScore≥0.8` 可配置 | ✅ 对照表「加入图片库」 |
| **OG / scraped** | ❌ 默认不自动 | ✅ 对照表「加入图片库」（推荐） |
| **本地上传** | 勾选「加入图片库」 | — |
| **从库选取** | — | 不新建 asset，`usageCount++` |

**设置项（P1，存 admin 偏好或 env）：**

```
☑ AI 生成成功后自动加入图片库          （默认 true）
☐ RSS 高相关图自动加入（≥80%）        （默认 false）
☐ 抓取图自动加入图片库                （默认 false）
```

### 7.3 去重

| 优先级 | 键 | 行为 |
|--------|-----|------|
| 1 | `contentHash` | 字节相同 → 同一 asset |
| 2 | 规范化 `originUrl` | 同 URL 抓取不重复落盘（P1） |

UI：点击「加入图片库」若已存在 → Toast「已在图片库，已关联本槽位」。

### 7.4 抓取图合规

- 库内标记 `source=scraped|og|rss`  
- 进库**必须落盘**，不单独存外链  
- MVP 不自动入库 scraped，由运营手动筛选  

---

## 8. 运营 UI

### 8.1 配图步骤 `IllustrateStepPanel`

**对照表**（一行一条资讯）：

| 列 | 内容 |
|----|------|
| # / 板块 | rank、section |
| 标题 | headline |
| 缩略图 | 点击放大 |
| 来源 | RSS / OG / AI / 上传 / 图库 |
| 图库 | ★ 已入库 / ○ 未入库 |
| 状态 | ready / failed |
| 操作 | 更换配图 · 加入图片库 · 在图库中查看 |

顶栏：`10 条 · 9 就绪 · 1 失败 · 图库 5`  
批量（P1）：`将本期全部 AI 配图加入图片库`

### 8.2 更换配图（单槽）

| 选项 | 说明 |
|------|------|
| 重新自动配图 | 再走瀑布 ①→②→③ |
| AI 重新生成 | 跳过 ①②，直接 ③；成功则按 §7.2 处理入库 |
| 本地上传 | jpg/png ≤1MB |
| 从图片库选择 | 弹窗网格，PATCH `assetId` |

换图成功后弹窗：**「是否重新生成 layout 以应用新图？」**

### 8.3 图片库页 `ImageLibraryView`

- 路由：`/image-assets`（与模板库并列）  
- 网格卡片：缩略图、name、source 标签、usageCount、provenance.headline  
- 筛选：source、tags、时间；搜索 name/tags  
- 操作：预览、编辑 name/tags、软删除  
- P2：从图库「用于新 Run」跳转配图步骤  

---

## 9. API

### 9.1 Pipeline / 配图

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/pipeline/runs/:id/steps/illustrate` | step 详情 |
| POST | `/pipeline/runs/:id/steps/illustrate/regenerate` | 整步重跑 |
| POST | `/pipeline/runs/:id/illustrate/slots/:slotId/regenerate` | `{ "mode": "auto" \| "generate" }` |
| PATCH | `/pipeline/runs/:id/illustrate/slots/:slotId` | `{ "assetId" }` 从库绑定 |
| POST | `/pipeline/runs/:id/illustrate/slots/:slotId/library` | 手动将当前槽位图 Ingest |
| POST | `/pipeline/runs/:id/illustrate/library/batch` | `{ "sources": ["generated"] }` 批量进库 |

### 9.2 媒体与图片库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/media/upload` | multipart `file`；query `addToLibrary=1` |
| GET | `/public/media/:assetId` | 公网读图（UUID 不可枚举） |
| GET | `/image-assets` | 列表 `?source=&tag=&q=` |
| GET | `/image-assets/:id` | 详情 |
| PATCH | `/image-assets/:id` | 改 name、tags |
| DELETE | `/image-assets/:id` | 软删 |

### 9.3 发布（衔接）

`publish` 前新增 `RewriteContentImagesForWeChat(html)`：

- 解析 `<img src>`，跳过已是 `mmbiz.qpic.cn`  
- 下载 → jpg/png ≤1MB（必要时压缩）→ `POST .../media/uploadimg`  
- 替换 src → `draft/add`  

微信 `uploadimg` 约束（已定）：仅服务端；jpg/png；≤1MB；返回 `url`；不占 10 万素材配额。

---

## 10. 存储

### 10.1 MySQL `image_assets`

```sql
CREATE TABLE image_assets (
  id            CHAR(36) PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  url           VARCHAR(1024) NOT NULL,
  storage       VARCHAR(32) NOT NULL DEFAULT 'local_volume',
  source        VARCHAR(32) NOT NULL,
  origin_url    VARCHAR(1024) NULL,
  prompt        TEXT NULL,
  mime_type     VARCHAR(64) NOT NULL,
  byte_size     INT UNSIGNED NOT NULL,
  width         INT UNSIGNED NULL,
  height        INT UNSIGNED NULL,
  content_hash  CHAR(64) NOT NULL,
  tags          JSON NULL,
  provenance    JSON NULL,
  usage_count   INT UNSIGNED NOT NULL DEFAULT 0,
  auto_ingested TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at    DATETIME(3) NULL,
  created_at    DATETIME(3) NOT NULL,
  updated_at    DATETIME(3) NOT NULL,
  UNIQUE KEY uk_image_assets_content_hash (content_hash),
  KEY idx_image_assets_source (source),
  KEY idx_image_assets_created (created_at DESC)
);
```

### 10.2 磁盘

- Docker volume：`media_data:/app/media`  
- 路径：`media/assets/{id}.jpg` 或 `.png`  
- `docker-compose.dev.yml` 挂载 api + worker  

### 10.3 step output

illustrate 输出存现有 `pipeline_steps.output_json`，无需新表。

---

## 11. LLM / Worker

| 组件 | 职责 |
|------|------|
| `illustrate` chain（P0 可无 LLM） | P0：Go 规则瀑布 + 调 Wanx；P1：可选 `illustrator` agent 打相关性分 |
| `cover` chain | 不变；封面独立 |
| `layout` chain | 输入加 `illustrations` |

Wanx 生图（正文配图 prompt 模板，P0）：

```
微信公众号科技资讯配图，横版 16:9，主题：{headline}，板块：{section}，
氛围：{summary 片段}，扁平矢量插画，无文字无水印，高清。
```

尺寸：与 `cover` 区分，建议 `1024*576` 或百炼支持横图规格。

---

## 12. 错误与降级

| 场景 | 行为 |
|------|------|
| 单槽失败 | `failed`，其余继续；illustrate 步整体 `succeeded`（degraded） |
| Ingest 重复 | 关联已有 asset，不报错 |
| 上传超限 | 400，`invalid image size/type` |
| uploadimg 40005/40009 | 转码/压缩后重试 1 次 |
| 无 PUBLIC_API_BASE_URL | 上传 URL 仅内网；UI 警告 |
| 软删 asset | 历史 slot.url 快照保留；新 Run 不可选 |

---

## 13. 分期交付

### P0（最小闭环）

- [ ] `illustrate` pipeline step + 瀑布 ①③（RSS + AI，OG 可 stub）  
- [ ] AI 成功自动 Ingest；落盘 `/public/media/`  
- [ ] `IllustrateStepPanel` 对照表 + 单槽 AI 重生 + 本地上传  
- [ ] 手动「加入图片库」按钮（RSS/已就绪图）  
- [ ] `ImageLibraryView` 列表（只读）  
- [ ] layout 消费 `illustrations`  
- [ ] publish `uploadimg` 正文图  
- [ ] `contracts/illustrate` schema  

### P1

- [ ] 从图片库选图绑定 slot  
- [ ] 单槽「重新自动配图」、OG 抓取  
- [ ] 批量进库、设置项、标签编辑  
- [ ] 换图后一键 regenerate layout  
- [ ] RSS 高相关自动入库（可选）  

### P2

- [ ] COS 存储后端  
- [ ] 上传可选即时 uploadimg  
- [ ] 感知哈希去重、图库应用到新 Run 向导  

---

## 14. 验收标准

### P0

1. 10 条资讯 → 10 槽位对照表，缩略图正确  
2. AI 配图自动进图库，图库页可看到，`contentHash` 去重生效  
3. RSS/抓取图可手动「加入图片库」，★ 状态更新  
4. 本地上传替换单槽，layout regenerate 后 HTML 含新图  
5. publish 草稿箱正文图可见（mmbiz）  
6. 单槽失败不导致整 Run 失败  

---

## 15. 术语

| 术语 | 含义 |
|------|------|
| 槽位 slot | 一条资讯对应的配图位 |
| ImageAsset | 图片库全局资产 |
| Ingest | 落盘 + 建/关联 asset 的统一入库 |
| uploadimg | 微信正文图片上传接口 |
| 瀑布 | RSS → OG → AI 优先级链 |
