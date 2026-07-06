import type { Metadata } from 'next'
import { LabClient } from '@/components/lab/LabClient'

export const metadata: Metadata = {
  title: 'The Lab — Yibin Feng',
  description: 'Immersive 3D corridor portfolio experience.',
}

export default function LabPage() {
  return <LabClient />
}
