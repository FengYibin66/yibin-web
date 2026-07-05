export const RUN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS]

export const STEP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const

export type StepStatus = (typeof STEP_STATUS)[keyof typeof STEP_STATUS]

export const PIPELINE_STEPS = [
  'collect',
  'rank',
  'enrich',
  'editor',
  'writer',
  'illustrate',
  'layout',
  'review',
  'cover',
  'publish',
] as const

export type PipelineStep = (typeof PIPELINE_STEPS)[number]

export const STEP_LABELS: Record<PipelineStep, string> = {
  collect: '采集',
  rank: '排序',
  enrich: '富化',
  editor: '选题',
  writer: '写作',
  illustrate: '配图',
  layout: '排版',
  review: '质检',
  cover: '封面',
  publish: '发布',
}

export const PUBLISH_MODE = {
  DRAFT_ONLY: 'draft_only',
} as const

export type PublishMode = (typeof PUBLISH_MODE)[keyof typeof PUBLISH_MODE]

export const POLL_INTERVAL_MS = 3000
