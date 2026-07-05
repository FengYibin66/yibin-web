export interface ReviewDimension {
  id: string
  name: string
  score: number
  feedback: string
}

export interface ParsedReview {
  overallScore: number
  dimensions: ReviewDimension[]
  summary: string
  issues: string[]
  /** 兼容旧版布尔质检 */
  legacy: boolean
}

const DIMENSION_LABELS: Record<string, string> = {
  factuality: '事实与来源',
  compliance: '合规表达',
  readability: '可读结构',
  wechatFit: '微信呈现',
}

/** 分数 → Element Plus 语义色 */
export function scoreStatus(score: number): 'success' | 'primary' | 'warning' | 'danger' {
  if (score >= 85) {
    return 'success'
  }
  if (score >= 70) {
    return 'primary'
  }
  if (score >= 55) {
    return 'warning'
  }
  return 'danger'
}

export function scoreLabel(score: number): string {
  if (score >= 85) {
    return '优秀'
  }
  if (score >= 70) {
    return '良好'
  }
  if (score >= 55) {
    return '待改进'
  }
  return '需重点关注'
}

export function scoreColor(score: number): string {
  switch (scoreStatus(score)) {
    case 'success':
      return 'var(--el-color-success)'
    case 'primary':
      return 'var(--el-color-primary)'
    case 'warning':
      return 'var(--el-color-warning)'
    default:
      return 'var(--el-color-danger)'
  }
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(n)))
}

function parseDimensions(raw: unknown): ReviewDimension[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const record = item as Record<string, unknown>
      const id = String(record.id ?? '')
      const score = clampScore(record.score)
      if (!id && score === 0 && !record.feedback) {
        return null
      }
      return {
        id: id || 'unknown',
        name: String(record.name ?? DIMENSION_LABELS[id] ?? id),
        score,
        feedback: String(record.feedback ?? ''),
      }
    })
    .filter((item): item is ReviewDimension => item !== null)
}

export function parseReview(record: Record<string, unknown> | null): ParsedReview | null {
  if (!record) {
    return null
  }

  const dimensions = parseDimensions(record.dimensions)
  if (dimensions.length > 0) {
    const overallRaw = record.overallScore
    const overallScore = overallRaw !== undefined && overallRaw !== null
      ? clampScore(overallRaw)
      : Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)

    return {
      overallScore,
      dimensions,
      summary: String(record.feedback ?? record.summary ?? ''),
      issues: Array.isArray(record.issues) ? record.issues.map(String) : [],
      legacy: false,
    }
  }

  const approved = record.approved === true
  return {
    overallScore: approved ? 82 : 58,
    dimensions: [],
    summary: String(record.feedback ?? ''),
    issues: Array.isArray(record.issues) ? record.issues.map(String) : [],
    legacy: true,
  }
}
