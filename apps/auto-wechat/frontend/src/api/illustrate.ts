import { request } from './request'

import type { IllustrationOutput } from '@/types/illustrate'
import type { ImageAsset } from '@/types/imageAsset'

export async function getIllustrationOutput(runId: string): Promise<IllustrationOutput> {
  return request.get<IllustrationOutput>(`/pipeline/runs/${runId}/illustrate`)
}

/** Wanx 生图较慢，超时需长于普通 API（与后端 LLM_INVOKE_TIMEOUT 对齐） */
const ILLUSTRATE_REGENERATE_TIMEOUT_MS = 10 * 60 * 1000

export async function regenerateIllustrationSlot(
  runId: string,
  slotId: string,
  mode: 'auto' | 'ai' = 'auto',
): Promise<IllustrationOutput> {
  return request.post<IllustrationOutput>(
    `/pipeline/runs/${runId}/illustrate/slots/${slotId}/regenerate`,
    { mode },
    { timeout: ILLUSTRATE_REGENERATE_TIMEOUT_MS },
  )
}

export async function ingestIllustrationSlot(
  runId: string,
  slotId: string,
): Promise<{ illustration: IllustrationOutput, asset: ImageAsset }> {
  return request.post<{ illustration: IllustrationOutput, asset: ImageAsset }>(
    `/pipeline/runs/${runId}/illustrate/slots/${slotId}/ingest`,
  )
}

export async function assignLibraryAssetToSlot(
  runId: string,
  slotId: string,
  assetId: string,
): Promise<IllustrationOutput> {
  return request.patch<IllustrationOutput>(
    `/pipeline/runs/${runId}/illustrate/slots/${slotId}`,
    { assetId },
  )
}
