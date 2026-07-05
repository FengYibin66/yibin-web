"""Hard constraints for few-shot full-page WeChat HTML generation."""

LAYOUT_FEWSHOT_CONSTRAINTS = """
## 硬性约束（违反任一条视为失败）

### A. 结构保真（模板驱动）
1. **以 templates[0] 为主模板**（排名第一）；templates[1]/[2] 仅作辅参考（通常不含 bodyHtml），不得拼接成混搭版式
2. 必须保留主模板整体 DOM 骨架：标签类型、嵌套层级、同级节点顺序
3. 若主模板含 `<svg>`：**完整保留**所有 `<svg>`、`<g>`、`<animate>`、`<animateTransform>`、`<path>`、`<text>`、`<tspan>`、`<rect>`、`<image>` 标签及其属性
4. **仅允许修改**以下内容：
   - 可见文案（标题、导语、板块名、资讯摘要、来源名）
   - 链接 href（换成本期真实 https 来源）
   - 日期、topic 类元信息
   - `coverImageUrl`（从 images 或 illustrations 选取）
   - **配图 URL**：须从 `illustrations.bySourceUrl` / `illustrations.slots` 填入真实 URL（与模板中 `.../public/media/{id}` 形式一致），**禁止删除** `<image>` / `<img>` 标签
5. **禁止修改**：
   - `animate`/`animateTransform` 的 attributeName、begin、dur、values、fill、restart、type 等动效参数
   - 卡片封面 `<image>` 的 `width`/`height`/`preserveAspectRatio`（仅可改 `href` 为 illustrate URL）
6. **卡片封面 `<image href>`**：按 `illustrations.slots` 的 rank 与 `bindTo.sourceUrl` 对应资讯，将 href 换为 slot.image.url（HTTPS 或 `/api/v1/public/media/...`）
7. **KPI 解读框** 内文须用 `<tspan>` 按宽度折行（约 536px），并根据行数 **动态增高** `<rect>` 容器，文字块在框内 **垂直居中**，上下 padding ≥24px

### B. 微信编辑器兼容
1. 只使用内联 `style=""`，禁止 `<style>` 标签
2. 禁止：script、iframe、form、video、audio、id 属性
3. SVG 内 `background-image:url(...)` 的 URL **不要加引号**
4. 正文除 SVG 外须保留可读的 HTML 文字（p/section）
5. 链接色建议 #576b95；来源须含可点击 `<a href="https://...">`

### C. 内容保真
1. 资讯事实以 writer 为准，不得杜撰
2. 每条资讯必须保留来源链接
3. 文末须有「参考来源」或等价 sources 区块（与 writer.sources 一致）
4. 板块结构须覆盖 editor.outline（除「导语」外每个 heading 在正文中可见）

### D. 输出格式
只输出 JSON：
{
  "title": "...",
  "coverImageUrl": "...",
  "bodyHtml": "<section>...</section>",
  "layoutNotes": "说明如何套用主模板、改了哪些槽位",
  "selectedTemplateId": "主模板 id"
}
不要 markdown 代码块。bodyHtml 必须是完整可发布 HTML。
"""
