# 09 · 微信排版方法论（Layout Engine）

> 文档版本：**v1.0**  
> 最后更新：2026-06-04  
> 状态：**已落地首版代码**（`backend/internal/wechatarticle/` + `contracts/layout/`）

---

## 1. 问题定义

排版节点的交付物是**可直接发布到微信公众号草稿箱的 `bodyHtml`**，质量标准包含三层，缺一不可：

| 层级 | 目标 | 反模式 |
|------|------|--------|
| **工程层** | 微信编辑器可吃进、来源可追溯、结构稳定 | LLM 每次手写不同 HTML 骨架 |
| **审美层** | 层级清晰、品牌一致、移动端舒适扫读 | 同质 `<p>` 墙、无板块边界 |
| **交互层** | 正文内轻交互（点击展开导读等），不跳 H5 | 整篇静态或过度动效分散注意力 |

参考范式：[微信公众号正文页 SVG 交互开发](https://zhuanlan.zhihu.com/p/75023148)（镜像：[张生荣转载](https://www.zhangshengrong.com/p/OQNzewL2aR/)）——微信内 **`svg` + SMIL `animate` + `begin="click"`** 是实现「精美 + 交互」的主流技术路径之一。

---

## 2. 核心原则（必须遵守）

### 2.1 主路径：模板库 + Few-shot 整页仿写（v1.1）

```
┌─────────────────────────────────────────────────────────────┐
│ layout_templates 模板库（运营精选 + Run 沉淀）                 │
│  完整 body_html · 含 SVG 交互 · 元数据 tags/article_type     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ template_matcher（LLM fast）                                 │
│  评估相关性 → Top3 templateId + score + reason               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ layout few-shot（LLM smart）                               │
│  Top3 全文 HTML 塞进 prompt · 以 templates[0] 为主模板        │
│  硬性约束（_layout_constraints.py）保护 SVG/微信规则          │
│  输出 bodyHtml + selectedTemplateId                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Go 校验 + 后处理                                            │
│  ValidateGeneratedHTML · PreserveSVGStructure · Enhance     │
└─────────────────────────────────────────────────────────────┘
```

**相信大模型仿写能力，但必须用约束锁死 SVG 动效与微信兼容。**

### 2.2 兜底路径：blocks 渲染（库为空时）

模板库为空时，`layout` 回退 `blocks` + `wechatarticle.Render`（见 §4）。

### 2.2 交互克制

- 每期 **≤ 1 个 SVG 交互块**（当前默认 `hero_svg` 导读展开）
- 交互服务于**渐进披露**（先看到标题/板块，点击再看导读详情）
- 正文资讯条目以**静态精美组件**呈现，保证可复制、可扫读

### 2.3 微信 SVG 潜规则（来自实测与社区）

| 规则 | 说明 |
|------|------|
| SVG 内禁 `<style>`、禁 `id`、禁 `<a>` | 导出用 Presentation Attributes |
| `background-image:url()` **URL 不加引号** | 否则被编辑器过滤 |
| 背景图须 **微信素材库** `mmbiz.qpic.cn` | 流水线 publish 前上传替换 |
| 正文须含**普通 HTML 文字** | 不能整篇只有 SVG |
| Android 点击动效后可能出现边框 | 相关 `<g>` 加 `style="outline:none"` |
| `animate` 链式时序 | 同组内 `begin="click"` + `begin="click+0.5"`，注意 `g` 层级 |

---

## 3. 质量维度（验收清单）

### 3.1 工程六维

1. **平台兼容** — 仅内联 style；无 script/iframe；标签闭合
2. **信息架构** — masthead → hero/lead → section → news_item → sources_footer
3. **阅读节奏** — 8px 间距体系；板块间留白 ≥ 24px
4. **内容保真** — blocks 与 `editor.outline` / `writer.sources` 一致
5. **来源合规** — 每条 `news_item` 有来源；文末 `sources_footer`；`EnhanceBodyHTML` 追加明文 URL
6. **工程稳定** — 同 blocks 输入 → 同 HTML 输出（确定性渲染）

### 3.2 审美八维

1. **视觉层级** — 刊头 / 导语 / 板块 / 条目 / 来源 五层可识别
2. **字体排版** — 系统字体栈；16px 正文 / 17px 板块 / 12px 来源
3. **色彩系统** — `theme.json` token；tag → accent 映射
4. **空间节奏** — 固定 spacing scale
5. **组件形态** — lead 卡片、色条板块头、条目卡片
6. **扫读密度** — 单条 2–4 行；首句可加粗作 headline
7. **品牌栏目感** — 固定刊头「AI 科技日报」+ 日期
8. **微交互** — 导读区点击展开；链接色 `#576b95` 可点击感

### 3.3 交互三维（SVG）

1. **范式** — 点击显隐 / 高度展开（`lead_expand`）
2. **舞台** — `viewBox` 与背景对齐；热区合理
3. **兼容** — 动效元素 `outline:none`；动效后维持 `fill="freeze"`

---

## 4. Blocks 契约

完整 JSON Schema：`contracts/layout/blocks.schema.json`

### 4.1 Block 类型一览

| type | 渲染方式 | 用途 |
|------|----------|------|
| `masthead` | 静态 HTML | 刊头：系列名 + 日期 + 可选 topic |
| `hero_svg` | **SVG 模板** | 点击展开导读（`variant: lead_expand`） |
| `lead` | 静态 HTML | 导语卡片（满足微信「须有文字」+ 无 SVG 降级可读） |
| `section` | 静态 HTML | 板块标题（tag 映射 accent 色条） |
| `news_item` | 静态 HTML | 单条资讯 + `[来源]` 链接 |
| `divider` | 静态 HTML | 板块间分隔 |
| `quote` | 静态 HTML | 引用块 |
| `figure` | 静态 HTML | 配图（可选） |
| `sources_footer` | 静态 HTML | 文末来源声明 |

### 4.2 推荐 block 顺序（AI 日报）

```
masthead
hero_svg          ← 唯一 SVG 交互
lead
section → news_item × N
divider           ← 板块之间
…
sources_footer
```

### 4.3 LLM 输入

| 字段 | 来源 |
|------|------|
| `writer` | 标题、导语、正文、sources |
| `editor` | outline（板块 heading/tag） |
| `images` | RSS 配图候选 |
| `feedback` | 人工重新生成时的修改意见 |

### 4.4 LLM 输出

只输出 `title`、`coverImageUrl`、`layoutNotes`、`blocks[]`。  
**不得**输出 `bodyHtml`（由 Go `wechatarticle.Render` 生成）。

---

## 5. 主题与设计 Token

文件：`backend/internal/wechatarticle/theme.json`

| Token 类 | 示例 |
|----------|------|
| `colors.textPrimary` | `#1a1a1a` |
| `colors.link` | `#576b95`（微信友好链接色） |
| `colors.surfaceLead` | `#f7f8fa` |
| `typography.bodySize` | `16px` |
| `spacing.sectionGap` | `28px` |
| `tagAccents.大模型` | `#2563eb` |

扩展新 tag：在 `theme.json` 的 `tagAccents` 增加键值，无需改 LLM。

---

## 6. SVG 模板：`hero_svg` / `lead_expand`

### 6.1 交互说明

1. 默认：刊头色带 + 日期 + 「点击展开今日导读」提示（文字闪烁 `animate opacity`）
2. 点击：`svg` 高度展开 + 导读全文 `opacity 0→1`（`begin="click+0.1"`）
3. 背景：有 `backgroundImageUrl`（素材库）则用 `background-image:url(...)` **无引号**；否则 SVG 内 `<rect>` 渐变

### 6.2 代码位置

`backend/internal/wechatarticle/render_svg.go` — `renderHeroLeadExpand`

### 6.3 扩展新 SVG 模板（操作手册）

1. 在 `render_svg.go` 新增函数，遵守微信 SVG 潜规则
2. 在 `blocks.schema.json` 的 `hero_svg.variant` 增加枚举值
3. 在 `parse_blocks.go` / `render.go` 的 switch 注册
4. 在 `docs/09` 本文档 §6 追加交互说明
5. 在 `render_test.go` 增加快照断言（含/不含违禁标签）
6. **禁止**让 LLM 生成 SVG 源码

---

## 7. 流水线集成

```
editor.outline ──┐
writer ──────────┼──► layout chain (blocks) ──► parseLayoutOutput
images ──────────┘         │                           │
                           │                    wechatarticle.Render
                           │                           │
                           ▼                           ▼
                    step output.blocks            bodyHtml + EnhanceBodyHTML
                           │                           │
                           └──────────► review (wechatFit 对照 checklist)
```

### 7.1 向后兼容

若 Layout 仍返回旧版 `bodyHtml`（无 `blocks`），`parseLayoutOutput` 直接使用并 `EnhanceBodyHTML`，不阻断存量 Run。

### 7.2 质检回流（规划）

`reviewer` 的 `wechatFit` 已对齐 blocks checklist。  
`approved=false && target=layout` 时，带着 `feedback` 重跑 layout（`MaxReviewRounds` 可后续调高）。

---

## 8. 运营与素材

| 步骤 | 动作 |
|------|------|
| 头图/SVG 背景 | 发布前上传微信素材库，URL 写入 `hero_svg.backgroundImageUrl` |
| 阅读原文 | 见 README「微信读者侧来源展示」 |
| 人工微调 | 控制台编辑 `bodyHtml` 保存成稿（覆盖渲染结果） |

---

## 9. 迭代路线

| 阶段 | 内容 |
|------|------|
| **P0 ✅** | blocks schema + Go 渲染器 + hero SVG + layout/reviewer 提示词 |
| **P1** | `section_accordion_svg` 板块折叠；review → layout 自动回流 |
| **P2** | publish 前自动上传素材库替换 URL |
| **P3** | 多套 theme；运营后台选主题 |
| **P4** | 黄金样刊回归测试（结构特征 diff） |

---

## 10. 参考文献

- [详细教你微信公众号正文页 SVG 交互开发技巧](https://zhuanlan.zhihu.com/p/75023148)
- [微信开放社区 · SVG animate vw 单位测试](https://developers.weixin.qq.com/community/develop/article/doc/0000c26fdc87b02d2e9ee572b5bc13)
- 本项目 `contracts/layout/blocks.schema.json`
- 本项目 `backend/internal/wechatarticle/` 源码

---

## 附录 A · Layout Planner 职责边界（给 Prompt 作者）

**可以做：**

- 按 `editor.outline` 顺序生成 `section` + `news_item`
- 从 `writer.summary` 填 `lead` 与 `hero_svg.leadText`
- 从 `writer.sources` 填 `sources_footer`
- 从 `images` 选 `coverImageUrl` / `figure.imageUrl`

**不可以做：**

- 写 HTML / SVG / CSS
- 改动资讯事实
- 合并两条资讯为一条（除非 writer 已合并）
- 省略 `sources_footer`
