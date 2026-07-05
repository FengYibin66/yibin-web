import type { TemplateMatchEntry } from '@/types/layoutTemplate'

export interface LayoutStepViewModel {
  renderEngine: string
  selectedTemplateId: string
  templateMatch: TemplateMatchEntry[]
  layoutNotes: string
  bodyHtml: string
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseTemplateMatch(raw: unknown): TemplateMatchEntry[] {
  if (!raw || typeof raw !== 'object') {
    return []
  }
  const ranked = (raw as Record<string, unknown>).ranked
  if (!Array.isArray(ranked)) {
    return []
  }
  return ranked
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const record = entry as Record<string, unknown>
      const templateId = readString(record.templateId)
      if (!templateId) {
        return null
      }
      const score = typeof record.score === 'number' ? record.score : Number(record.score) || 0
      return {
        templateId,
        score,
        reason: readString(record.reason),
      }
    })
    .filter((item): item is TemplateMatchEntry => item !== null)
}

export function parseLayoutStepOutput(output: unknown): LayoutStepViewModel | null {
  if (!output || typeof output !== 'object') {
    return null
  }
  const record = output as Record<string, unknown>
  const bodyHtml = readString(record.bodyHtml)
  const templateMatch = parseTemplateMatch(record.templateMatch)

  if (!bodyHtml && templateMatch.length === 0 && !readString(record.renderEngine)) {
    return null
  }

  return {
    renderEngine: readString(record.renderEngine),
    selectedTemplateId: readString(record.selectedTemplateId),
    templateMatch,
    layoutNotes: readString(record.layoutNotes),
    bodyHtml,
  }
}

export function articleTypeLabel(articleType: string): string {
  const map: Record<string, string> = {
    daily_digest: 'AI 日报合集',
  }
  return map[articleType] ?? articleType
}

export function itemCountLabel(min: number, max: number): string {
  if (min > 0 && max < 99) {
    return `${min}–${max} 条资讯`
  }
  if (min > 0) {
    return `≥ ${min} 条`
  }
  return '条数不限'
}
