import type { IllustrationOutput } from '@/types/illustrate'
import type { StepDetailArtifact } from '@/types/artifacts'

export function parseIllustrateStepOutput(
  stepDetail: StepDetailArtifact | null | undefined,
): IllustrationOutput | null {
  const output = stepDetail?.output
  if (!output || typeof output !== 'object') {
    return null
  }
  const raw = output as IllustrationOutput
  if (!Array.isArray(raw.slots)) {
    return null
  }
  return raw
}

export const ILLUSTRATION_SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  og: 'OG',
  scraped: '抓取',
  generated: 'AI 生成',
  upload: '本地上传',
  library: '图片库',
}
