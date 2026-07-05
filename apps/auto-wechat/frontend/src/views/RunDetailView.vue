<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getRunArtifacts, getRunStep } from '@/api/artifacts'
import { getPipelineRun } from '@/api/pipeline'
import StepNav from '@/components/run/StepNav.vue'
import StepPanel from '@/components/run/StepPanel.vue'
import RunStatusTag from '@/components/RunStatusTag.vue'
import { usePolling } from '@/composables/usePolling'
import { PIPELINE_STEPS, RUN_STATUS, type PipelineStep } from '@/constants/pipeline'
import { ROUTE_NAMES } from '@/constants/routes'
import { formatDateTime } from '@/utils/format'
import {
  applyRegeneratingFromStep,
  isStepAtOrAfter,
  optimisticClearArtifacts,
  stepIndex,
} from '@/utils/pipelineSteps'

import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import type { PipelineRun } from '@/types/pipeline'

const props = defineProps<{
  id: string
}>()

const route = useRoute()
const router = useRouter()

const artifacts = ref<RunArtifacts | null>(null)
const stepDetail = ref<StepDetailArtifact | null>(null)
const panelLoading = ref(false)
/** 用户触发的重新生成起点，用于下游展示「重新生成中」并阻止旧数据回填 */
const regeneratingFrom = ref<PipelineStep | null>(null)

const activeStep = computed<PipelineStep>(() => {
  const queryStep = route.query.step
  if (typeof queryStep === 'string' && PIPELINE_STEPS.includes(queryStep as PipelineStep)) {
    return queryStep as PipelineStep
  }
  return 'collect'
})

const { data: run, loading, error, start } = usePolling<PipelineRun>({
  fetcher: () => getPipelineRun(props.id),
  shouldStop: (currentRun) => {
    if (currentRun.status === RUN_STATUS.RUNNING || currentRun.status === RUN_STATUS.QUEUED) {
      return false
    }
    return !currentRun.steps.some((step) => step.status === 'running')
  },
})

const isRunActive = computed(() => {
  return run.value?.status === RUN_STATUS.RUNNING || run.value?.status === RUN_STATUS.QUEUED
})

async function loadArtifacts(): Promise<void> {
  try {
    artifacts.value = await getRunArtifacts(props.id)
  } catch {
    artifacts.value = null
  }
}

async function loadStepDetail(step: PipelineStep): Promise<void> {
  panelLoading.value = true
  try {
    stepDetail.value = await getRunStep(props.id, step)
  } catch {
    stepDetail.value = null
  } finally {
    panelLoading.value = false
  }
}

async function refreshWorkspace(): Promise<void> {
  start()
  await Promise.all([loadArtifacts(), loadStepDetail(activeStep.value)])
}

function handleSelectStep(step: PipelineStep): void {
  void router.replace({ name: ROUTE_NAMES.RUN_DETAIL, params: { id: props.id }, query: { step } })
}

function handleBack(): void {
  void router.push({ name: ROUTE_NAMES.PIPELINE_TRIGGER })
}

function applyRegeneratingStepDetail(step: PipelineStep): void {
  const now = new Date().toISOString()
  stepDetail.value = {
    step,
    status: 'running',
    errorMessage: null,
    startedAt: now,
    finishedAt: null,
    output: undefined,
  }
}

function handleRegenerateStarted(step: PipelineStep): void {
  regeneratingFrom.value = step
  if (run.value) {
    run.value.status = RUN_STATUS.RUNNING
    run.value.errorMessage = null
    applyRegeneratingFromStep(run.value.steps, step)
  }
  if (artifacts.value) {
    optimisticClearArtifacts(artifacts.value, step)
  }
  if (isStepAtOrAfter(activeStep.value, step)) {
    applyRegeneratingStepDetail(activeStep.value)
  }
}

async function handleRegenerateCommitted(step: PipelineStep): Promise<void> {
  regeneratingFrom.value = step
  try {
    run.value = await getPipelineRun(props.id)
  } catch {
    // 保持乐观状态，轮询会纠正
  }
  await loadArtifacts()
  if (isStepAtOrAfter(activeStep.value, step)) {
    const current = run.value?.steps.find((item) => item.step === activeStep.value)
    if (current?.status === 'running') {
      applyRegeneratingStepDetail(activeStep.value)
    } else {
      void loadStepDetail(activeStep.value)
    }
  }
  start()
}

async function handleRegenerateFailed(): Promise<void> {
  regeneratingFrom.value = null
  await refreshWorkspace()
}

watch(
  () => props.id,
  () => {
    start()
    void refreshWorkspace()
  },
  { immediate: true },
)

watch(activeStep, (step) => {
  void loadStepDetail(step)
})

watch(
  () => run.value?.steps,
  (steps) => {
    if (!steps) {
      return
    }
    if (regeneratingFrom.value) {
      const fromIdx = stepIndex(regeneratingFrom.value)
      const stillRegenerating = steps.some(
        (item) => stepIndex(item.step) >= fromIdx && item.status === 'running',
      )
      if (!stillRegenerating) {
        regeneratingFrom.value = null
      }
    }
    if (!regeneratingFrom.value) {
      void loadArtifacts()
    }
    const current = steps.find((item) => item.step === activeStep.value)
    const shouldRefreshStepDetail = current && (
      current.status === 'running'
      || current.status === 'pending'
      || (regeneratingFrom.value && current.status === 'failed')
    )
    if (shouldRefreshStepDetail) {
      void loadStepDetail(activeStep.value)
    }
  },
  { deep: true },
)

watch(isRunActive, (active) => {
  if (!active) {
    void refreshWorkspace()
  }
})
</script>

<template>
  <div
    v-loading="loading && !run"
    class="run-workspace"
  >
    <el-result
      v-if="error"
      icon="error"
      title="加载失败"
      :sub-title="error"
    />

    <template v-else-if="run">
      <header class="run-workspace__toolbar">
        <el-button
          text
          @click="handleBack"
        >
          ← 返回
        </el-button>
        <div class="run-workspace__title">
          <span class="run-workspace__label">Run 工作台</span>
          <span class="run-workspace__id">{{ run.id.slice(0, 8) }}…</span>
        </div>
        <RunStatusTag :status="run.status" />
        <el-button
          text
          size="small"
          class="run-workspace__refresh"
          @click="refreshWorkspace"
        >
          刷新
        </el-button>
      </header>

      <div class="run-workspace__meta">
        <span>创建 {{ formatDateTime(run.createdAt) }}</span>
        <span v-if="run.finishedAt">完成 {{ formatDateTime(run.finishedAt) }}</span>
        <span v-if="run.digestItemCount != null">Digest {{ run.digestItemCount }} 条</span>
        <span v-if="run.layoutTemplateName">排版模板 {{ run.layoutTemplateName }}</span>
        <span v-else-if="run.layoutTemplateId">排版模板已指定</span>
        <el-tag
          v-if="run.draftMediaId"
          type="success"
          size="small"
          effect="plain"
        >
          已发布 {{ run.draftMediaId }}
        </el-tag>
      </div>

      <el-alert
        v-if="isRunActive"
        type="info"
        show-icon
        :closable="false"
        title="Pipeline 运行中"
        description="左侧节点状态会自动刷新。点击任意已完成节点查看产物、编辑或重新生成。"
        class="run-workspace__alert"
      />

      <el-alert
        v-if="run.errorMessage"
        type="error"
        show-icon
        :closable="false"
        :title="run.errorMessage"
        class="run-workspace__alert"
      />

      <div class="run-workspace__layout">
        <aside class="run-workspace__sidebar">
          <StepNav
            :steps="run.steps"
            :active-step="activeStep"
            :regenerating-from="regeneratingFrom"
            @select="handleSelectStep"
          />
        </aside>

        <main class="run-workspace__main">
          <StepPanel
            :run-id="id"
            :step="activeStep"
            :step-detail="stepDetail"
            :artifacts="artifacts"
            :loading="panelLoading"
            :regenerating-from="regeneratingFrom"
            :layout-template-id="run.layoutTemplateId"
            :layout-template-name="run.layoutTemplateName"
            @refreshed="refreshWorkspace"
            @regenerate-started="handleRegenerateStarted"
            @regenerate-committed="handleRegenerateCommitted"
            @regenerate-failed="handleRegenerateFailed"
          />
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.run-workspace {
  --workspace-toolbar-height: 52px;
  margin: -24px;
  min-height: calc(100vh - 56px);
  background: var(--el-fill-color-lighter);
}

.run-workspace__toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--workspace-toolbar-height);
  padding: 0 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.run-workspace__title {
  display: flex;
  flex-direction: column;
}

.run-workspace__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.run-workspace__id {
  font-size: 14px;
  font-weight: 600;
}

.run-workspace__refresh {
  margin-left: auto;
}

.run-workspace__meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.run-workspace__alert {
  margin: 12px 20px 0;
}

.run-workspace__layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  padding: 16px 20px 32px;
  max-width: 1440px;
  margin: 0 auto;
}

.run-workspace__sidebar {
  position: sticky;
  top: calc(var(--workspace-toolbar-height) + 12px);
  align-self: start;
  padding: 12px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.run-workspace__main {
  min-width: 0;
  padding: 20px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 960px) {
  .run-workspace__layout {
    grid-template-columns: 1fr;
  }

  .run-workspace__sidebar {
    position: static;
  }
}
</style>
