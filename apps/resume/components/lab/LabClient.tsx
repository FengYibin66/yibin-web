'use client'

import dynamic from 'next/dynamic'
import { LabLoader } from './LabLoader'

const LabScene = dynamic(
  () => import('./LabScene').then(m => ({ default: m.LabScene })),
  { ssr: false, loading: () => <LabLoader /> }
)

export function LabClient() {
  return <LabScene />
}
