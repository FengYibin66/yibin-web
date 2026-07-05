export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedList<T> {
  items: T[]
  total: number
}
