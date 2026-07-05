import { request } from './request'

import type { ImageAsset } from '@/types/imageAsset'

export interface ListImageAssetsParams {
  source?: string
  q?: string
}

export async function listImageAssets(params: ListImageAssetsParams = {}): Promise<ImageAsset[]> {
  const data = await request.get<{ items: ImageAsset[] }>('/image-assets', { params })
  return data.items ?? []
}

export async function getImageAsset(id: string): Promise<ImageAsset> {
  return request.get<ImageAsset>(`/image-assets/${id}`)
}

export async function deleteImageAsset(id: string): Promise<void> {
  await request.delete(`/image-assets/${id}`)
}

export async function uploadMedia(file: File, name?: string): Promise<ImageAsset> {
  const form = new FormData()
  form.append('file', file)
  if (name) {
    form.append('name', name)
  }
  return request.post<ImageAsset>('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
