import type { Metadata } from 'next'
import { GalleryClient } from '@/components/gallery/GalleryClient'

export const metadata: Metadata = {
  title: 'Gallery — Yibin Feng',
  description: 'A collection of photographs from Iceland, Paris, London, Kuala Lumpur, and beyond.',
}

export default function GalleryPage() {
  return (
    <main style={{ background: '#f0ece4', minHeight: '100vh' }}>
      <GalleryClient />
    </main>
  )
}
