'use client'

import dynamic from 'next/dynamic'

const LabScene = dynamic(
  () => import('./LabScene').then(m => ({ default: m.LabScene })),
  { ssr: false }
)

export function LabClient() {
  return <LabScene />
}
