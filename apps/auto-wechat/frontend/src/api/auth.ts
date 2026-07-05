import { post, get } from '@/api/request'

export interface AuthUser {
  username: string
  role: string
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return post<AuthUser>('/auth/login', { username, password })
}

export async function logout(): Promise<void> {
  await post<{ ok: boolean }>('/auth/logout')
}

export async function fetchMe(): Promise<AuthUser> {
  return get<AuthUser>('/auth/me')
}
