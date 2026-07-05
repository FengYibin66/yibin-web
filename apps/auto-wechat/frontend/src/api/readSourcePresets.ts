import { request } from './request'

import type { CreateReadSourcePresetPayload, ReadSourcePreset } from '@/types/readSourcePreset'

export async function listReadSourcePresets(): Promise<ReadSourcePreset[]> {
  const data = await request.get<{ items: ReadSourcePreset[] }>('/read-source-presets')
  return data.items ?? []
}

export async function createReadSourcePreset(payload: CreateReadSourcePresetPayload): Promise<ReadSourcePreset> {
  return request.post<ReadSourcePreset>('/read-source-presets', payload)
}

export async function deleteReadSourcePreset(id: string): Promise<void> {
  await request.delete(`/read-source-presets/${id}`)
}
