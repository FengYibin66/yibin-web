# 样例模板 · 每日 AI 科技必看

临时组合稿，调通后导入后端排版模板库。

## 文件

| 文件 | 色系 | 说明 |
|------|------|------|
| [daily-ai-tech-dark.html](./daily-ai-tech-dark.html) | 暗色 | 深底全篇，科技感强 |
| [daily-ai-tech-light.html](./daily-ai-tech-light.html) | 淡色 | 浅底全篇，阅读轻松 |

## 封面图 URL（单一来源）

模板里 `<image href>` **只用** `image_assets` 的 public URL，与流水线 illustrate 产出格式一致。

```
image_assets（tag: template-sample）
        ↓
few-shot/template-sample-urls.json   ← make sync-layout-templates 写入
        ↓
_gen_cards.py 生成 daily-ai-tech-*.html
        ↓
layout_templates（DB）
        ↓
layout LLM 仿写 → 换成本期 illustrate URL
```

**不要**在 HTML 里写 `amazon-tshirt-main-images` 相对路径；本地预览也走 media URL（需 API 可访问）。

首次或改卡片结构后：

```bash
make sync-layout-templates
```

## 版式结构（自上而下）

```
┌─────────────────────────────┐
│  §1 轨道粒子刊头             │  ← template-orbit-hero
│  每日AI科技必看 × YYYY年M月D日 │
├─────────────────────────────┤
│  §2 今日核心指标             │  ← template-counter-digit
│  三圆 KPI + 点击展开解读      │
├─────────────────────────────┤
│  §3 新闻卡片 × N             │  每张：封面图 + 吸睛标题
│  点击 peel 渐变 → 详情正文    │  + 「点击查看详情」脉冲提示
├─────────────────────────────┤
│  §4 参考来源                 │
├─────────────────────────────┤
│  §5 作者致谢                 │  恳请留言反馈，助力平台打磨
└─────────────────────────────┘
```

## 可变字段（流水线填充）

- `{{DATE}}` → 刊头日期，如 `2026年6月4日`
- `{{KPI_*}}` → 三个指标数值与标签
- `{{NEWS_ITEMS}}` → 新闻卡片数组（标题、封面图、详情、来源链接）
- `{{SOURCES}}` → 参考来源列表

样例中写死 10 张卡片；正式模板 `itemCountMin: 3`、`itemCountMax: 10`。

## 新闻卡渲染逻辑

微信正文里 SVG **不是** HTML 的 flex/block 撑满，而是：

1. **外层**：`<svg style="width:100%">` → SVG 元素宽度 = 父级 100%
2. **内层**：`viewBox="0 0 640 H"` → 内部用固定坐标系，等比缩放映射到实际像素
3. **贴边**：卡片内容坐标 `x=0, width=640`
4. **封面图**：
   - 槽位 **640×360（16:9）**，与 illustrate `1024×576` 同比例
   - `href` 为 `/api/v1/public/media/{id}` 或带域名的完整 URL（来自 `template-sample-urls.json`）
   - layout 排版时 LLM 须换为本期 `illustrations.slots` URL
   - `preserveAspectRatio="xMidYMid meet"` → 完整显示、不裁剪
5. **双层**：
   - **底层**：详情全文（tspan 折行）
   - **顶层 `<g>`**（封面）：图片 + 渐变 + 标题区 peel
6. **点击**：整组 `opacity→0` + `visibility→hidden`，露出底层详情

## KPI 解读框

- footnote 文案须 **tspan 折行**（宽约 536px），行数增多时 **同步加高** 圆角 `<rect>`
- 文字块在框内 **垂直居中**，上下 padding ≥24px，避免贴边溢出

## 左右留白：用 padding，不用 margin

`margin` 在 DevTools 里会显示，但**留白区域渲染的是父级背景色**（暗色版 `#030712`），和周围几乎融为一体，看起来像「没 margin」。

致谢/参考来源与新闻卡统一为：

```html
<section style="padding:0 16px;">        <!-- 外层：撑开左右留白 -->
  <section style="padding:...;background:...">  <!-- 内层：有色卡片 -->
```

## 微信发布

- 发布前图片须 `uploadimg` 替换为 `mmbiz.qpic.cn`
