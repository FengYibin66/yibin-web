import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'

import { createPipelineRun, deletePipelineRun, listPipelineRuns } from '@/api/pipeline'
import { PUBLISH_MODE, RUN_STATUS } from '@/constants/pipeline'
import { ROUTE_NAMES } from '@/constants/routes'

import type { PipelineRun } from '@/types/pipeline'

export function usePipelineRun() {
  const router = useRouter()
  const recentRuns = ref<PipelineRun[]>([])
  const listLoading = ref(false)
  const triggerLoading = ref(false)

  async function fetchRecentRuns(): Promise<void> {
    listLoading.value = true
    try {
      recentRuns.value = await listPipelineRuns({ limit: 10 })
    } finally {
      listLoading.value = false
    }
  }

  async function triggerRun(): Promise<void> {
    triggerLoading.value = true
    try {
      const run = await createPipelineRun({ publishMode: PUBLISH_MODE.DRAFT_ONLY })
      await router.push({ name: ROUTE_NAMES.RUN_DETAIL, params: { id: run.id } })
    } finally {
      triggerLoading.value = false
    }
  }

  async function deleteRun(run: PipelineRun): Promise<void> {
    const isActive = run.status === RUN_STATUS.RUNNING || run.status === RUN_STATUS.QUEUED
    const message = isActive
      ? '该 Run 仍在执行中。删除将取消队列任务、释放 Worker 锁，并永久删除该 Run 及所有步骤与成稿数据。'
      : '删除后无法恢复，将永久删除该 Run 及所有步骤、Digest、成稿与发布记录。'

    try {
      await ElMessageBox.confirm(message, '删除 Run', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      })
    } catch {
      return
    }

    try {
      await deletePipelineRun(run.id)
      ElMessage.success(isActive ? '已停止并删除该 Run' : '已删除该 Run')
      recentRuns.value = recentRuns.value.filter((item) => item.id !== run.id)
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
      await fetchRecentRuns()
    }
  }

  return {
    recentRuns,
    listLoading,
    triggerLoading,
    fetchRecentRuns,
    triggerRun,
    deleteRun,
  }
}
