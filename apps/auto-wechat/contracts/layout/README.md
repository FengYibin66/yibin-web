# Layout 契约

- **主路径（v1.1）**：`layout_templates` 库 → `template_matcher` Top3 → `layout` few-shot 仿写 → `bodyHtml`
- **兜底**：`blocks.schema.json` — 库为空时 blocks → Go `wechatarticle.Render`
- **方法论** — [docs/09-wechat-layout-methodology.md](../../docs/09-wechat-layout-methodology.md)

```text
模板库 → matcher Top3 → layout(bodyHtml) → Validate + Enhance → 微信草稿箱
运营满意 → POST /pipeline/runs/:id/layout-templates 沉淀入库
```
