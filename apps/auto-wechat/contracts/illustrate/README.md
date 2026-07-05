# Illustrate 契约

配图环节（`illustrate`）与图片库（`ImageAsset`）的输入输出约定。

- **PRD** — [docs/10-illustrate-image-library-prd.md](../../docs/10-illustrate-image-library-prd.md)
- **流水线位置** — `writer` → `illustrate` → `layout`

## 文件

| 文件 | 说明 |
|------|------|
| `illustration.output.schema.json` | step `illustrate` 的 `output_json` |
| `image-asset.schema.json` | 图片库实体 API 响应 |
| `layout-input-illustrations.schema.json` | 传给 layout chain 的 `illustrations` 字段 |

## 数据流

```text
digest + articles + writer
    → illustrate（瀑布 + 可选 Ingest）
    → IllustrationOutput（slots + stats）
    → layout（illustrations.bySourceUrl + 模板）
    → bodyHtml（含 <img>）
    → publish（uploadimg 替换为 mmbiz）
```

## 入库规则（摘要）

| source | 自动 Ingest | 手动 |
|--------|-------------|------|
| generated | 默认是 | 可重复点（去重） |
| rss / og / scraped | 默认否 | 对照表「加入图片库」 |
| upload | 勾选加入图库 | — |
| library | 不新建 | PATCH assetId，usageCount++ |
