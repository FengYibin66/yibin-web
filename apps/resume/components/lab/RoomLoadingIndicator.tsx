'use client'

import type { RoomId } from '@/context/SceneContext'
import { ROOM_LOAD_TIMEOUT_CODE } from './useDoorEntryOrchestrator'
import type { RoomLoadState } from '@/lib/lab/roomLoadMachine'

import styles from './RoomLoadingIndicator.module.css'
import { useLabLabels } from '@/hooks/useLabLabels'
import type { LabUiLabels } from '@/lib/content/types'

interface RoomLoadingIndicatorProps {
  state: RoomLoadState
  onRetry: () => void
  onBack: () => void
}

/*
  文案走 i18n（审计 E7）。房间名从 `labUi.doors` 取，与门牌是同一份——
  原先这里另写了一张英文表，于是门牌改了名字这里不会跟着改。
*/
/**
 * `state.error` → 显示文案 + 可选的技术细节。
 *
 * 这个字段有两类来源：
 *
 * - **超时**：一个码（`ROOM_LOAD_TIMEOUT_CODE`），有对应译文
 * - **房间抛异常**：`RoomReadyBoundary` 捕获到的异常信息，是英文的技术串
 *   （"Failed to fetch dynamically imported module…" 这种）
 *
 * 第二类不能当标题直接显示——中文用户看到的是一句看不懂的英文（审计 E7），
 * 但它对排查有用，所以降为次要细节行。标题一律是本地化的。
 */
function describeError(
  labels: LabUiLabels,
  raw: string | null | undefined,
): { text: string; detail: string | null } {
  if (raw === ROOM_LOAD_TIMEOUT_CODE) {
    return { text: labels.hints.loadTimedOut, detail: null }
  }
  return {
    text: labels.loading.failedHint,
    detail: raw && raw.trim().length > 0 ? raw : null,
  }
}

function loadingLabel(labels: LabUiLabels, roomId: RoomId): string {
  return `${labels.loading.preparing} · ${labels.doors[roomId]}`
}

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
  labels,
}: Pick<RoomLoadingIndicatorProps, 'onRetry' | 'onBack'> & {
  error: { text: string; detail: string | null }
  labels: LabUiLabels
}) {
  return (
    <div className={styles.card} role="alert" data-testid="room-load-failed">
      <p className={styles.label}>{labels.loading.failed}</p>
      <p className={styles.error}>{error.text}</p>
      {error.detail !== null && (
        // 技术细节：小字、可选中，便于反馈问题时复制
        <p className={styles.error} style={{ opacity: 0.6, fontSize: '0.8em', userSelect: 'text' }}>
          {error.detail}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={onRetry}>
          {labels.loading.retry}
        </button>
        <button className={styles.button} type="button" onClick={onBack}>
          {labels.loading.backToCorridor}
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
  const labels = useLabLabels()
  const isLoading = state.phase === 'aligning' || state.phase === 'loading'
  if (!isLoading && state.phase !== 'failed') return null
  if (state.roomId === null) return null

  const label = loadingLabel(labels, state.roomId)
  const isFailed = state.phase === 'failed'
  return (
    <div className={isFailed ? `${styles.overlay} ${styles.overlayFailed}` : styles.overlay}>
      {isLoading && <LoadingContent label={label} />}
      {isFailed && (
        <FailureContent
          error={describeError(labels, state.error)}
          labels={labels}
          onRetry={onRetry}
          onBack={onBack}
        />
      )}
    </div>
  )
}
