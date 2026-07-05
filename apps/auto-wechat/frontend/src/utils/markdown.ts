import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(source: string): string {
  if (!source.trim()) {
    return '<p style="color:#999;">暂无内容</p>'
  }
  return marked.parse(source) as string
}
