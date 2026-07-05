import type { PipelineStep, StepStatus } from '@/constants/pipeline'

export interface RankedItem {
  url: string
  title: string
  score: number
  reason?: string
  summary?: string
  summaryZh?: string
  tags?: string[]
  source?: string
}

export interface DigestArtifact {
  id: string
  runId: string
  items: RankedItem[]
  stats?: Record<string, unknown>
}

export interface ContentDraftArtifact {
  id: string
  runId: string
  digestId?: string
  title: string
  summary: string
  bodyMarkdown: string
  bodyHtml: string
  coverUrl?: string
  coverMediaId?: string
  readSourcePresetId?: string
  status: string
  editor?: Record<string, unknown>
  review?: Record<string, unknown>
}

export interface StepDetailArtifact {
  step: PipelineStep
  status: StepStatus
  input?: unknown
  output?: unknown
  errorMessage: string | null
  durationMs?: number | null
  startedAt: string | null
  finishedAt: string | null
}

export interface PublishResultArtifact {
  draftMediaId: string
  publishMode: string
  createdAt?: string
}

export interface RunArtifacts {
  runId: string
  runStatus: string
  publishMode: string
  digest?: DigestArtifact
  contentDraft?: ContentDraftArtifact
  steps: StepDetailArtifact[]
  draftMediaId?: string | null
  previewHtml?: string | null
  publishResult?: PublishResultArtifact
}

export interface UpdateDraftPayload {
  title?: string
  summary?: string
  bodyMarkdown?: string
  bodyHtml?: string
  coverUrl?: string
  readSourcePresetId?: string
}

export interface PublishRunPayload {
  readSourcePresetId?: string
}

export interface UpdateDigestPayload {
  items: RankedItem[]
}

/** POST /pipeline/runs/:id/steps/:step/regenerate 受理回执（非实时进度） */
export interface RegenerateStepResponse {
  runId: string
  step: PipelineStep
  status: 'running'
  affectedSteps: PipelineStep[]
  cascade: boolean
}
