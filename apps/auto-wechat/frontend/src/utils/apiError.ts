import type { AxiosError } from 'axios'

import type { ApiResponse } from '@/types/api-common'

export function getApiErrorCode(err: unknown): number | null {
  if (!err || typeof err !== 'object' || !('response' in err)) {
    return null
  }
  const axiosErr = err as AxiosError<ApiResponse<unknown>>
  const code = axiosErr.response?.data?.code
  return typeof code === 'number' ? code : null
}
