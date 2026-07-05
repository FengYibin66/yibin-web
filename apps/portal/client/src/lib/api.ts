import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

export interface Profile {
  id: number
  nameEn: string; nameZh: string
  bioEn: string; bioZh: string
  avatarPath: string
  github: string; linkedin: string; email: string
  updatedAt: number
}

export interface Project {
  id: number
  nameEn: string; nameZh: string
  descEn: string; descZh: string
  techTags: string        // JSON string
  screenshotPath: string | null
  url: string
  status: 'live' | 'dev'
  order: number
  visible: number
}

// --- Public ---
export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
  })
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  })
}

// --- Admin ---
export function useAllProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    queryFn: () => api.get('/projects/all').then((r) => r.data),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Profile>) => api.put('/profile', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Project, 'id'>) => api.post('/projects', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Project) => api.put(`/projects/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: (password: string) => api.post('/auth/login', { password }),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
  })
}

export function useAuthCheck() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    retry: false,
  })
}

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/uploads', form)
  return data.path
}
