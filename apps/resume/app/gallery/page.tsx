import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gallery — Yibin Feng',
  description: 'A collection of photographs from Iceland, Paris, London, Kuala Lumpur, and beyond.',
}

const GalleryTrack = dynamic(
  () => import('@/components/gallery/GalleryTrack').then(m => ({ default: m.GalleryTrack })),
  { ssr: false }
)

export default function GalleryPage() {
  return (
    <main style={{ background: '#f0ece4', minHeight: '100vh' }}>
      <GalleryTrack />
    </main>
  )
}
