import { request } from './request'

import type {
  ContentDraftArtifact,
  DigestArtifact,
  PublishResultArtifact,
  RegenerateStepResponse,
  RunArtifacts,
  UpdateDigestPayload,
  PublishRunPayload,
  UpdateDraftPayload,
  StepDetailArtifact,
} from '@/types/artifacts'
import type { PipelineStep } from '@/constants/pipeline'

export async function getRunArtifacts(runId: string): Promise<RunArtifacts> {
  return request.get<RunArtifacts>(`/pipeline/runs/${runId}/artifacts`)
}

export async function getRunStep(runId: string, step: PipelineStep): Promise<StepDetailArtifact> {
  return request.get<StepDetailArtifact>(`/pipeline/runs/${runId}/steps/${step}`)
}

export async function regenerateRunStep(
  runId: string,
  step: PipelineStep,
  replace = false,
): Promise<RegenerateStepResponse> {
  return request.post<RegenerateStepResponse>(`/pipeline/runs/${runId}/steps/${step}/regenerate`, undefined, {
    params: replace ? { replace: 'true' } : undefined,
  })
}

export async function updateRunDraft(runId: string, payload: UpdateDraftPayload): Promise<ContentDraftArtifact> {
  return request.put<ContentDraftArtifact>(`/pipeline/runs/${runId}/draft`, payload)
}

export async function updateRunDigest(runId: string, payload: UpdateDigestPayload): Promise<DigestArtifact> {
  return request.put<DigestArtifact>(`/pipeline/runs/${runId}/digest`, payload)
}

export async function publishRun(runId: string, payload?: PublishRunPayload): Promise<PublishResultArtifact> {
  return request.post<PublishResultArtifact>(`/pipeline/runs/${runId}/publish`, payload ?? {})
}
