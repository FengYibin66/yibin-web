'use client'

import type { RoomId } from '@/context/SceneContext'
import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

import styles from './RoomLoadingIndicator.module.css'

interface RoomLoadingIndicatorProps {
  state: RoomLoadState
  onRetry: () => void
  onBack: () => void
}

const ROOM_LOADING_LABELS: Record<RoomId, string> = {
  about: 'Preparing About…',
  projects: 'Preparing Projects…',
  publications: 'Preparing Publications…',
  gallery: 'Opening Gallery…',
  contact: 'Preparing Contact…',
}

const FALLBACK_ERROR = 'The room could not be prepared.'

function InkAnimation() {
  return (
    <svg
      className={styles.ink}
      viewBox="0 0 100 56"
      aria-hidden="true"
      fill="none"
    >
      <path
        className={styles.inkPath}
        d="M8 35C18 18 31 46 43 25S66 12 60 35s23 11 32-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className={styles.inkPath}
        d="M17 43c18-7 38 4 67-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LoadingContent({ label }: { label: string }) {
  return (
    <div className={styles.card} role="status" aria-live="polite">
      <InkAnimation />
      <p className={styles.label}>{label}</p>
    </div>
  )
}

function FailureContent({
  error,
  onRetry,
  onBack,
}: Pick<RoomLoadingIndicatorProps, 'onRetry' | 'onBack'> & { error: string }) {
  return (
    <div className={styles.card} role="alert">
      <p className={styles.label}>The room stayed closed</p>
      <p className={styles.error}>{error}</p>
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={onRetry}>
          Retry
        </button>
        <button className={styles.button} type="button" onClick={onBack}>
          Back to corridor
        </button>
      </div>
    </div>
  )
}

export function RoomLoadingIndicator({
  state,
  onRetry,
  onBack,
}: RoomLoadingIndicatorProps) {
  const isLoading = state.phase === 'aligning' || state.phase === 'loading'
  if (!isLoading && state.phase !== 'failed') return null
  if (state.roomId === null) return null

  const label = ROOM_LOADING_LABELS[state.roomId]
  return (
    <div className={styles.overlay}>
      {isLoading && <LoadingContent label={label} />}
      {state.phase === 'failed' && (
        <FailureContent
          error={state.error ?? FALLBACK_ERROR}
          onRetry={onRetry}
          onBack={onBack}
        />
      )}
    </div>
  )
}
