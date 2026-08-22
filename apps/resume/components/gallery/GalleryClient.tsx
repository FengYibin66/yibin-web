'use client'

import dynamic from 'next/dynamic'

import { GalleryLoading } from './GalleryLoading'

// `ssr: false` 是必要的（GalleryTrack 依赖浏览器 API），但**必须配 loading**：
// 没有它时 chunk 到位之前整页只剩背景色，用户看到一片空白（验收报告 P1-3）。
const GalleryTrack = dynamic(
  () => import('./GalleryTrack').then((m) => ({ default: m.GalleryTrack })),
  { ssr: false, loading: () => <GalleryLoading /> }
)

export function GalleryClient() {
  return <GalleryTrack />
}
