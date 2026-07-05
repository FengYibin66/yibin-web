# few-shot 交互案例库

本目录收录可导入排版模板库的 **微信公众号 SVG 交互** 样例，实现遵循 Skill `fyb-wechat-content-development`（自研 SMIL，不依赖小墨鹰/135 等第三方编辑器）。

## 案例清单

| 文件 | 交互能力 | 对标第三方组件 |
|------|----------|----------------|
| [../template-tech-interactive-daily.html](../template-tech-interactive-daily.html) | **全交互合集**：导读展开 + 自动无缝滚动图廊 + 点击逐层换图 + 脉冲时间线 + 点击激活板块 | S100780、S100779、导读、时间线、板块激活 |
| [../template-hero-expand.html](../template-hero-expand.html) | 点击遮罩展开导读 | 点击-伸长 |
| [../template-long-unfold.html](../template-long-unfold.html) | 长图纵向 scaleY 展开 | 点击-伸长 / 长图展开 |
| [../template-timeline-pulse.html](../template-timeline-pulse.html) | 时间轴脉冲 + 条目标题点击高亮 | 时间线/脉冲节点 |
| [../template-card-reveal.html](../template-card-reveal.html) | 板块标题点击激活进度条 | 点击激活标签 |
| [../template-tab-selector.html](../template-tab-selector.html) | 四层 Tab 预绘 + peel 切换内容 | 无限选择器 |
| [../template-hotzone-poster.html](../template-hotzone-poster.html) | 海报多热区 + 点击伸长弹出详情 | 多热区弹出式海报 |
| [../template-flip-quiz.html](../template-flip-quiz.html) | 答题卡 scaleX 挤压 + 揭示答案 | 答题翻转 |
| [../template-scratch-reveal.html](../template-scratch-reveal.html) | 灰色蒙层点击淡出揭晓彩蛋 | 刮刮卡 / 抽奖 |
| [../template-auto-fade-carousel.html](../template-auto-fade-carousel.html) | 多图 opacity 自动交叉淡入 | 自动轮播 |
| [../template-text-reveal.html](../template-text-reveal.html) | 祝福卡封面点击 peel 显文 | 文字点击隐藏显示 |
| [../template-slide-steps.html](../template-slide-steps.html) | 分步卡片点击 translate 滑出 | 滑动后点击（SVG 模拟） |
| [../template-before-after.html](../template-before-after.html) | Before/After 单层 peel 对比 | 点击换图 / 对比滑块 |
| [../template-orbit-hero.html](../template-orbit-hero.html) | 轨道自动旋转 + 点击能量脉冲 | 科技感刊头 / 粒子装饰 |
| [../template-counter-digit.html](../template-counter-digit.html) | KPI 脉冲环 + 点击展开解读 | 数据发布会 / 脉动引导 |

## 动效覆盖矩阵

| 第三方动效分类 | 状态 | 对应模板 |
|----------------|------|----------|
| 点击-伸长 | ✅ | hero-expand, long-unfold |
| 点击-切换图片 | ✅ | tech-daily 轮播, before-after |
| 无限选择器 | ✅ | tab-selector |
| 滑动后点击 | ✅（模拟） | slide-steps |
| 多热区弹出式海报 | ✅ | hotzone-poster |
| 答题翻转 | ✅ | flip-quiz |
| 自动轮播 | ✅ | auto-fade-carousel, tech-daily 滚动图廊 |
| 文字点击隐藏显示 | ✅ | text-reveal |
| 刮刮卡揭晓 | ✅ | scratch-reveal |
| 轨道/粒子装饰 | ✅ | orbit-hero, counter-digit |

## 样例图片

`../amazon-tshirt-main-images/` 共 6 张 PNG，在各模板中作图廊/海报占位。

**微信发布前**：须 `uploadimg` / 素材库上传，将 `href` 换为 `https://mmbiz.qpic.cn/...`。

## 合规要点（交互必读）

- 禁用 SVG 内 `id`、`<script>`、`<style>`、`<a>`
- **`begin="click"` 的 `<animate>` 必须与可点击遮罩处于同一 `<g>`**，且 `animate` 为 direct child；禁止 `begin="foo.click"` 跨元素引用
- 推荐 **hero 遮罩 peel**：底层预绘内容 + 顶层遮罩 `<g>` 内 `opacity 1→0`
- **多层 peel 必加** `visibility visible→hidden`（与 opacity 同 `begin="click"`），否则 Chrome/真机上 `opacity=0` 仍挡下层点击
- 禁止「透明热区 rect」与「animate 子元素」分属兄弟节点却指望联动（微信真机常失效）
- 点击热区加 `style="outline:none"`；Tab 选择器等需 `pointer-events:none` 防止误触整层 peel
- 外链放 HTML `<a>`，不放 SVG 内

## 本地预览

```bash
cd few-shot
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765/template-tech-interactive-daily.html
```

## 导入模板库

将 HTML 全文复制到「排版模板库 → 导入 HTML」，或通过流水线 seed / `CreateFromRunDraft` 沉淀。
