import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Lab — Yibin Feng',
  description: 'Immersive 3D corridor portfolio experience.',
}

const LabScene = dynamic(
  () => import('@/components/lab/LabScene').then(m => ({ default: m.LabScene })),
  { ssr: false }
)

export default function LabPage() {
  return <LabScene />
}
