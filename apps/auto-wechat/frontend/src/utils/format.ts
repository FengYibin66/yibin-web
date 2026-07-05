import { RUN_STATUS, STEP_LABELS, type PipelineStep, type RunStatus, type StepStatus } from '@/constants/pipeline'

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('zh-CN')
}

export function getRunStatusLabel(status: RunStatus): string {
  const labels: Record<RunStatus, string> = {
    [RUN_STATUS.QUEUED]: '排队中',
    [RUN_STATUS.RUNNING]: '运行中',
    [RUN_STATUS.SUCCEEDED]: '成功',
    [RUN_STATUS.FAILED]: '失败',
  }
  return labels[status]
}

export function getStepLabel(step: PipelineStep): string {
  return STEP_LABELS[step]
}

export function getStepStatusLabel(status: StepStatus, regenerating = false): string {
  if (status === 'running' && regenerating) {
    return '重新生成中'
  }
  const labels: Record<StepStatus, string> = {
    pending: '等待中',
    running: '执行中',
    succeeded: '已完成',
    failed: '失败',
    skipped: '已跳过',
  }
  return labels[status] ?? status
}

export function getStepStatusTagType(status: StepStatus): 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'succeeded') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'running') {
    return 'warning'
  }
  return 'info'
}

export function getRunStatusTagType(status: RunStatus): 'info' | 'success' | 'warning' | 'danger' {
  if (status === RUN_STATUS.SUCCEEDED) {
    return 'success'
  }
  if (status === RUN_STATUS.FAILED) {
    return 'danger'
  }
  if (status === RUN_STATUS.RUNNING) {
    return 'warning'
  }
  return 'info'
}
