export interface ReadSourcePreset {
  id: string
  label: string
  url: string
  sortOrder: number
  createdAt?: string
}

export interface CreateReadSourcePresetPayload {
  label: string
  url: string
}
