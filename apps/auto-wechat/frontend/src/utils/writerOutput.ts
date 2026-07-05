import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import type { WriterSourceRef, WriterStepOutput } from '@/types/writer'

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function parseSources(raw: unknown): WriterSourceRef[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const record = entry as Record<string, unknown>
      const name = readString(record.name)
      const url = readString(record.url)
      if (!url) {
        return null
      }
      return { name: name || url, url }
    })
    .filter((item): item is WriterSourceRef => item !== null)
}

export function parseWriterOutput(output: unknown): WriterStepOutput | null {
  if (!output || typeof output !== 'object') {
    return null
  }

  const record = output as Record<string, unknown>
  const title = readString(record.title)
  const bodyMarkdown = readString(record.bodyMarkdown)

  if (!title && !bodyMarkdown) {
    return null
  }

  return {
    title,
    titleCandidates: readStringArray(record.titleCandidates),
    summary: readString(record.summary),
    bodyMarkdown,
    sources: parseSources(record.sources),
  }
}

export function resolveWriterOutput(
  stepDetail: StepDetailArtifact | null,
  artifacts: RunArtifacts | null,
): WriterStepOutput | null {
  const fromStep = parseWriterOutput(stepDetail?.output)
  if (fromStep?.bodyMarkdown || fromStep?.title) {
    return fromStep
  }

  const draft = artifacts?.contentDraft
  if (!draft) {
    return null
  }

  return parseWriterOutput({
    title: draft.title,
    summary: draft.summary,
    bodyMarkdown: draft.bodyMarkdown,
    titleCandidates: [],
    sources: [],
  })
}

export function countMarkdownSections(markdown: string): number {
  const matches = markdown.match(/^##\s+/gm)
  return matches?.length ?? 0
}

export function estimateWordCount(text: string): number {
  const stripped = text.replace(/\s+/g, '')
  return stripped.length
}
