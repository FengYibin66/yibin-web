import type { PipelineStep, PublishMode, RunStatus, StepStatus } from '@/constants/pipeline'

export interface PipelineRunStep {
  step: PipelineStep
  status: StepStatus
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
}

export interface PipelineRun {
  id: string
  status: RunStatus
  publishMode: PublishMode
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  errorMessage: string | null
  steps: PipelineRunStep[]
  draftMediaId: string | null
  previewHtml: string | null
  digestId?: string | null
  digestItemCount?: number | null
  contentDraftId?: string | null
  layoutTemplateId?: string | null
  layoutTemplateName?: string | null
}

export interface CreateRunPayload {
  publishMode: PublishMode
}

export interface ListRunsParams {
  limit?: number
  offset?: number
}
