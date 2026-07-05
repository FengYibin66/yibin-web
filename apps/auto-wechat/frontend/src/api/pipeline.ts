import { request } from './request'

import type { CreateRunPayload, ListRunsParams, PipelineRun } from '@/types/pipeline'

export async function createPipelineRun(payload: CreateRunPayload): Promise<PipelineRun> {
  return request.post<PipelineRun>('/pipeline/runs', payload)
}

export async function getPipelineRun(id: string): Promise<PipelineRun> {
  return request.get<PipelineRun>(`/pipeline/runs/${id}`)
}

export async function listPipelineRuns(params: ListRunsParams = {}): Promise<PipelineRun[]> {
  return request.get<PipelineRun[]>('/pipeline/runs', { params })
}

export interface UpdateRunLayoutTemplatePayload {
  layoutTemplateId?: string | null
  useGlobalDefault?: boolean
  clearTemplate?: boolean
}

export async function updateRunLayoutTemplate(
  runId: string,
  payload: UpdateRunLayoutTemplatePayload,
): Promise<PipelineRun> {
  return request.put<PipelineRun>(`/pipeline/runs/${runId}/layout-template`, payload)
}

export async function deletePipelineRun(runId: string): Promise<void> {
  await request.delete(`/pipeline/runs/${runId}`)
}
