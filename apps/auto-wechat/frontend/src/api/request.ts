import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

import type { ApiResponse } from '@/types/api-common'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

function createRequestClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.response.use(
    (response) => {
      const payload = response.data as ApiResponse<unknown>
      if (payload && typeof payload.code === 'number' && payload.code !== 0) {
        ElMessage.error(payload.message || '请求失败')
        return Promise.reject(new Error(payload.message || '业务错误'))
      }
      return response
    },
    (error: AxiosError<ApiResponse<unknown>>) => {
      const status = error.response?.status
      const message = error.response?.data?.message ?? error.message
      const requestUrl = error.config?.url ?? ''

      if (status === 401) {
        const isAuthBootstrap = requestUrl.includes('/auth/me') || requestUrl.includes('/auth/login')
        if (!isAuthBootstrap) {
          onUnauthorized?.()
          ElMessage.error('登录已过期，请重新登录')
        }
      } else if (status === 403) {
        ElMessage.error('无权限')
      } else {
        ElMessage.error(message || '网络错误')
      }

      return Promise.reject(error)
    },
  )

  return client
}

const client = createRequestClient()

function unwrap<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data
}

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.get<ApiResponse<T>>(url, config)
  return unwrap(response)
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.post<ApiResponse<T>>(url, body, config)
  return unwrap(response)
}

export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.put<ApiResponse<T>>(url, body, config)
  return unwrap(response)
}

export async function patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.patch<ApiResponse<T>>(url, body, config)
  return unwrap(response)
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.delete<ApiResponse<T>>(url, config)
  return unwrap(response)
}

export const request = { get, post, put, patch, delete: del }
