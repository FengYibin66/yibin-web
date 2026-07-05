import { PIPELINE_STEPS, type PipelineStep } from '@/constants/pipeline'

import type { RunArtifacts } from '@/types/artifacts'

export function stepIndex(step: PipelineStep): number {
  return PIPELINE_STEPS.indexOf(step)
}

export function stepsFrom(step: PipelineStep): PipelineStep[] {
  const idx = stepIndex(step)
  if (idx < 0) {
    return []
  }
  return PIPELINE_STEPS.slice(idx)
}

export function isStepAtOrAfter(step: PipelineStep, from: PipelineStep): boolean {
  return stepIndex(step) >= stepIndex(from)
}

/** 点击重新生成后，本节点及下游立即展示为 running（重新生成中） */
export function applyRegeneratingFromStep(
  steps: Array<{ step: PipelineStep, status: string, errorMessage: string | null, startedAt: string | null, finishedAt: string | null }>,
  from: PipelineStep,
): void {
  const fromIdx = stepIndex(from)
  if (fromIdx < 0) {
    return
  }
  const now = new Date().toISOString()
  const publishIdx = stepIndex('publish')
  for (const item of steps) {
    const itemIdx = stepIndex(item.step)
    if (itemIdx < fromIdx) {
      continue
    }
    // 发布为手动步骤：从配图/排版等重生时不要误标为 running。
    if (item.step === 'publish' && fromIdx < publishIdx) {
      item.status = 'pending'
      item.errorMessage = null
      item.startedAt = null
      item.finishedAt = null
      continue
    }
    item.status = 'running'
    item.errorMessage = null
    item.startedAt = now
    item.finishedAt = null
  }
}

/** 与后端 Invalidate* 逻辑对齐，用于重生提交后的乐观 UI */
export function optimisticClearArtifacts(artifacts: RunArtifacts, from: PipelineStep): void {
  const fromIdx = stepIndex(from)
  if (fromIdx < 0) {
    return
  }

  artifacts.runStatus = 'running'

  if (fromIdx <= stepIndex('enrich') && artifacts.digest) {
    artifacts.digest.items = []
  }

  const draft = artifacts.contentDraft
  if (draft) {
    if (fromIdx <= stepIndex('editor')) {
      draft.editor = undefined
    }
    if (fromIdx <= stepIndex('writer')) {
      draft.title = ''
      draft.summary = ''
      draft.bodyMarkdown = ''
    }
    if (fromIdx <= stepIndex('illustrate')) {
      draft.bodyHtml = ''
    }
    if (fromIdx <= stepIndex('layout')) {
      draft.bodyHtml = ''
    }
    if (fromIdx <= stepIndex('review')) {
      draft.review = undefined
    }
    if (fromIdx <= stepIndex('cover')) {
      draft.coverUrl = ''
      draft.coverMediaId = ''
    }
  }

  if (fromIdx <= stepIndex('layout')) {
    artifacts.previewHtml = null
  }
  if (fromIdx <= stepIndex('publish')) {
    artifacts.draftMediaId = null
    artifacts.publishResult = undefined
  }
}
