import { request } from './request'

import type {
  CreateLayoutTemplatePayload,
  LayoutTemplateDetail,
  LayoutTemplateSummary,
  SaveRunAsLayoutTemplatePayload,
} from '@/types/layoutTemplate'

export async function listLayoutTemplates(): Promise<LayoutTemplateSummary[]> {
  const data = await request.get<{ items: LayoutTemplateSummary[] }>('/layout-templates')
  return data.items ?? []
}

export async function getLayoutTemplate(id: string): Promise<LayoutTemplateDetail> {
  return request.get<LayoutTemplateDetail>(`/layout-templates/${id}`)
}

export async function createLayoutTemplate(
  payload: CreateLayoutTemplatePayload,
): Promise<LayoutTemplateDetail> {
  return request.post<LayoutTemplateDetail>('/layout-templates', payload)
}

export async function deleteLayoutTemplate(id: string): Promise<void> {
  await request.delete(`/layout-templates/${id}`)
}

export async function setDefaultLayoutTemplate(id: string): Promise<LayoutTemplateDetail> {
  return request.patch<LayoutTemplateDetail>(`/layout-templates/${id}/default`)
}

export async function saveRunAsLayoutTemplate(
  runId: string,
  payload: SaveRunAsLayoutTemplatePayload,
): Promise<LayoutTemplateDetail> {
  return request.post<LayoutTemplateDetail>(`/pipeline/runs/${runId}/layout-templates`, payload)
}
