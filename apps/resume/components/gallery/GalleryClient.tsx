'use client'

import dynamic from 'next/dynamic'

const GalleryTrack = dynamic(
  () => import('./GalleryTrack').then(m => ({ default: m.GalleryTrack })),
  { ssr: false }
)

export function GalleryClient() {
  return <GalleryTrack />
}
