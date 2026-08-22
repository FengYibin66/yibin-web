/**
 * 解析 project.techTags。
 *
 * 库里 `tech_tags` 是自由文本列（schema 的 CHECK 约束只覆盖 status 与 visible），
 * 所以它**不保证是合法 JSON**：早期手工写入、迁移、或将来的批量脚本都可能留下脏值。
 *
 * 渲染路径绝不能因单条脏数据整体崩掉——`Projects.tsx` 原先直接
 * `JSON.parse(project.techTags ?? '[]')`，一条非法 JSON 就会让首页项目区白屏。
 * 这里统一退化为空数组。
 *
 * 同时做形状校验：即使 parse 成功，也可能是 `{"a":1}` 或 `[1,2]` 这类非
 * string[] 的值，直接渲染会得到 `[object Object]` 或让 `.join()` 出意外结果。
 */
export function parseTechTags(raw: string | null | undefined): string[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []
  // 只保留真正的字符串项，避免数字/对象混进标签渲染
  return parsed.filter((item): item is string => typeof item === 'string')
}
