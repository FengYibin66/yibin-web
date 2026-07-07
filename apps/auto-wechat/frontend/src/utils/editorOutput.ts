import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'

export interface OutlineEntry {
  heading: string
  tag?: string
  bullets: string[]
}

export interface EditorStepOutput {
  articleType: string
  topic: string
  angle: string
  outline: OutlineEntry[]
  selectedUrls: string[]
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function parseOutline(raw: unknown): OutlineEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry): OutlineEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const record = entry as Record<string, unknown>
      const heading = readString(record.heading)
      if (!heading) {
        return null
      }
      const bullets = readStringArray(record.bullets)
      const tag = readString(record.tag)
      return { heading, bullets, tag: tag ? tag : undefined }
    })
    .filter((entry): entry is OutlineEntry => entry !== null)
}

export function parseEditorOutput(output: unknown): EditorStepOutput | null {
  if (!output || typeof output !== 'object') {
    return null
  }

  const record = output as Record<string, unknown>
  const topic = readString(record.topic)
  if (!topic) {
    return null
  }

  return {
    articleType: readString(record.articleType) || 'daily_digest',
    topic,
    angle: readString(record.angle),
    outline: parseOutline(record.outline),
    selectedUrls: readStringArray(record.selectedUrls),
  }
}

export function resolveEditorOutput(
  stepDetail: StepDetailArtifact | null,
  artifacts: RunArtifacts | null,
): EditorStepOutput | null {
  const fromStep = parseEditorOutput(stepDetail?.output)
  if (fromStep) {
    return fromStep
  }

  const editor = artifacts?.contentDraft?.editor
  if (editor && typeof editor === 'object') {
    return parseEditorOutput(editor)
  }

  return null
}
