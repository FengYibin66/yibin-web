import type { Metadata } from 'next'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { GalleryBackButton } from '@/components/gallery/GalleryBackButton'
import { GalleryFooter } from '@/components/gallery/GalleryFooter'

export const metadata: Metadata = {
  title: 'Gallery — Yibin Feng',
  description: 'A collection of photographs from Iceland, Paris, London, Kuala Lumpur, and beyond.',
}

export default function GalleryPage() {
  return (
    <main style={{ background: '#f0ece4', minHeight: '100vh' }}>
      <GalleryBackButton />
      <GalleryClient />
      <GalleryFooter />
    </main>
  )
}
