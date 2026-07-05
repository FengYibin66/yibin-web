import { request } from './request'

export interface CreateWeChatPreviewPayload {
  title?: string
  bodyHtml?: string
  runId?: string
  layoutTemplateId?: string
}

export interface WeChatPreviewSession {
  token: string
  previewUrl: string
  expiresIn: number
  localOnly: boolean
  localHint?: string
}

export async function createWeChatPreviewSession(
  payload: CreateWeChatPreviewPayload,
): Promise<WeChatPreviewSession> {
  return request.post<WeChatPreviewSession>('/preview/wechat-sessions', payload)
}

export function wechatPreviewQrImageUrl(previewUrl: string, size = 220): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: '8',
    data: previewUrl,
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}
