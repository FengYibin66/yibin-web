<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  publishRun,
  regenerateRunStep,
  updateRunDigest,
  updateRunDraft,
} from '@/api/artifacts'
import ReadSourcePresetSelect from '@/components/ReadSourcePresetSelect.vue'
import CollectStepPanel from '@/components/run/CollectStepPanel.vue'
import EditorStepPanel from '@/components/run/EditorStepPanel.vue'
import EnrichStepPanel from '@/components/run/EnrichStepPanel.vue'
import WriterStepPanel from '@/components/run/WriterStepPanel.vue'
import IllustrateStepPanel from '@/components/run/IllustrateStepPanel.vue'
import LayoutStepPanel from '@/components/run/LayoutStepPanel.vue'
import RankStepPanel from '@/components/run/RankStepPanel.vue'
import ReviewScorePanel from '@/components/run/ReviewScorePanel.vue'
import { RUN_STATUS, STEP_LABELS, type PipelineStep } from '@/constants/pipeline'
import { formatDateTime, getStepStatusLabel } from '@/utils/format'
import { isStepAtOrAfter, stepIndex, stepsFrom } from '@/utils/pipelineSteps'

import { getApiErrorCode } from '@/utils/apiError'

import type { RankedItem, RunArtifacts, StepDetailArtifact } from '@/types/artifacts'

const API_CODE_RUN_REPLACE_REQUIRED = 40901

const props = defineProps<{
  runId: string
  step: PipelineStep
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  loading: boolean
  regeneratingFrom?: PipelineStep | null
  layoutTemplateId?: string | null
  layoutTemplateName?: string | null
}>()

const emit = defineEmits<{
  refreshed: []
  regenerateStarted: [step: PipelineStep]
  regenerateCommitted: [step: PipelineStep]
  regenerateFailed: []
}>()

const saving = ref(false)
const regenerating = ref(false)
const publishing = ref(false)

const digestItems = ref<RankedItem[]>([])
const digestSnapshot = ref('')

const draftForm = reactive({
  title: '',
  summary: '',
  bodyMarkdown: '',
  bodyHtml: '',
  coverUrl: '',
})

const draftSnapshot = reactive({
  title: '',
  summary: '',
  bodyMarkdown: '',
  bodyHtml: '',
  coverUrl: '',
})

const readSourcePresetId = ref('')
const readSourcePresetSnapshot = ref('')

const stepTitle = computed(() => STEP_LABELS[props.step])

const isInRegenerateRange = computed(() => {
  return Boolean(
    props.regeneratingFrom
    && isStepAtOrAfter(props.step, props.regeneratingFrom),
  )
})

const isRegenerating = computed(() => {
  return isInRegenerateRange.value && props.stepDetail?.status === 'running'
})

const stepStatusLabel = computed(() => {
  const status = props.stepDetail?.status ?? 'pending'
  return getStepStatusLabel(status, isRegenerating.value)
})

const isWorkerActive = computed(() => {
  const runStatus = props.artifacts?.runStatus
  if (runStatus === RUN_STATUS.RUNNING || runStatus === RUN_STATUS.QUEUED) {
    return true
  }
  if (props.artifacts?.steps?.some((item) => item.status === 'running')) {
    return true
  }
  return props.stepDetail?.status === 'running'
})

const canRegenerate = computed(() => {
  if (regenerating.value || isRegenerating.value) {
    return false
  }
  return true
})

const isDraftDirty = computed(() => {
  return (
    draftForm.title !== draftSnapshot.title
    || draftForm.summary !== draftSnapshot.summary
    || draftForm.bodyMarkdown !== draftSnapshot.bodyMarkdown
    || draftForm.bodyHtml !== draftSnapshot.bodyHtml
    || draftForm.coverUrl !== draftSnapshot.coverUrl
    || readSourcePresetId.value !== readSourcePresetSnapshot.value
  )
})

const isDigestDirty = computed(() => JSON.stringify(digestItems.value) !== digestSnapshot.value)

const formattedOutput = computed(() => {
  if (!props.stepDetail?.output) {
    return ''
  }
  try {
    return JSON.stringify(props.stepDetail.output, null, 2)
  } catch {
    return String(props.stepDetail.output)
  }
})

function stepOutputField(output: unknown, key: string): string {
  if (!output || typeof output !== 'object') {
    return ''
  }
  const value = (output as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

const reviewSource = computed(() => {
  const draftReview = props.artifacts?.contentDraft?.review
  if (draftReview && typeof draftReview === 'object') {
    return draftReview as Record<string, unknown>
  }
  if (props.step === 'review' && props.stepDetail?.output) {
    return props.stepDetail.output as Record<string, unknown>
  }
  return null
})

const layoutBodyHtml = computed({
  get() {
    if (draftForm.bodyHtml.trim()) {
      return draftForm.bodyHtml
    }
    return stepOutputField(props.stepDetail?.output, 'bodyHtml')
  },
  set(value: string) {
    draftForm.bodyHtml = value
  },
})

function syncFormsFromArtifacts(data: RunArtifacts | null): void {
  digestItems.value = data?.digest?.items ? [...data.digest.items] : []
  digestSnapshot.value = JSON.stringify(digestItems.value)

  const draft = data?.contentDraft
  draftForm.title = draft?.title ?? ''
  draftForm.summary = draft?.summary ?? ''
  draftForm.bodyMarkdown = draft?.bodyMarkdown ?? ''
  draftForm.bodyHtml = draft?.bodyHtml ?? ''
  draftForm.coverUrl = draft?.coverUrl ?? ''
  readSourcePresetId.value = draft?.readSourcePresetId ?? ''

  if (props.step === 'layout' && !draftForm.bodyHtml.trim()) {
    const fromStep = stepOutputField(props.stepDetail?.output, 'bodyHtml')
    if (fromStep) {
      draftForm.bodyHtml = fromStep
    }
  }

  captureDraftSnapshot()
}

function captureDraftSnapshot(): void {
  draftSnapshot.title = draftForm.title
  draftSnapshot.summary = draftForm.summary
  draftSnapshot.bodyMarkdown = draftForm.bodyMarkdown
  draftSnapshot.bodyHtml = draftForm.bodyHtml
  draftSnapshot.coverUrl = draftForm.coverUrl
  readSourcePresetSnapshot.value = readSourcePresetId.value
}

async function handleSaveDraft(): Promise<void> {
  saving.value = true
  try {
    await updateRunDraft(props.runId, {
      ...draftForm,
      readSourcePresetId: readSourcePresetId.value || undefined,
    })
    captureDraftSnapshot()
    ElMessage.success('成稿已保存')
    emit('refreshed')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSaveDigest(): Promise<void> {
  saving.value = true
  try {
    await updateRunDigest(props.runId, { items: digestItems.value })
    digestSnapshot.value = JSON.stringify(digestItems.value)
    ElMessage.success('Digest 已保存')
    emit('refreshed')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function clearDownstreamDisplay(from: PipelineStep): void {
  const fromIdx = stepIndex(from)
  if (fromIdx < 0) {
    return
  }
  if (fromIdx <= stepIndex('enrich')) {
    digestItems.value = []
    digestSnapshot.value = '[]'
  }
  if (fromIdx <= stepIndex('writer')) {
    draftForm.title = ''
    draftForm.summary = ''
    draftForm.bodyMarkdown = ''
  }
  if (fromIdx <= stepIndex('layout')) {
    draftForm.bodyHtml = ''
  }
  if (fromIdx <= stepIndex('cover')) {
    draftForm.coverUrl = ''
  }
  captureDraftSnapshot()
}

function buildRegenerateConfirmMessage(includeWorkerWarning: boolean): string {
  const downstream = stepsFrom(props.step)
    .filter((s) => s !== props.step)
    .map((s) => STEP_LABELS[s])
    .join(' → ')

  const cascade = downstream
    ? `将重新执行「${stepTitle.value}」，并自动级联：${downstream}，直至封面（发布需手动）。本节点及下游产物会被清空后重写。`
    : `将重新执行「${stepTitle.value}」。本节点产物会被清空后重写。`

  if (!includeWorkerWarning) {
    return cascade
  }
  return `该 Run 仍有 Worker 任务在执行。继续将取消当前任务，并重新开始生成。\n\n${cascade}`
}

async function confirmRegenerate(includeWorkerWarning: boolean): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      buildRegenerateConfirmMessage(includeWorkerWarning),
      includeWorkerWarning ? '取消任务并重新生成' : '重新生成',
      {
        confirmButtonText: includeWorkerWarning ? '取消任务并重新生成' : '重新生成',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: includeWorkerWarning ? 'el-button--danger' : undefined,
      },
    )
    return true
  } catch {
    return false
  }
}

async function handleRegenerate(): Promise<void> {
  let replace = isWorkerActive.value
  if (!(await confirmRegenerate(replace))) {
    return
  }

  clearDownstreamDisplay(props.step)
  emit('regenerateStarted', props.step)

  regenerating.value = true
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await regenerateRunStep(props.runId, props.step, replace)
        ElMessage.success(replace ? '已取消旧任务并开始级联重新生成' : '已开始级联重新生成')
        emit('regenerateCommitted', props.step)
        return
      } catch (err) {
        if (getApiErrorCode(err) === API_CODE_RUN_REPLACE_REQUIRED && !replace) {
          if (!(await confirmRegenerate(true))) {
            emit('regenerateFailed')
            return
          }
          replace = true
          continue
        }
        ElMessage.error(err instanceof Error ? err.message : '提交失败')
        emit('regenerateFailed')
        return
      }
    }
  } finally {
    regenerating.value = false
  }
}

async function handlePublish(): Promise<void> {
  publishing.value = true
  try {
    if (isDraftDirty.value) {
      await handleSaveDraft()
    }
    if (!readSourcePresetId.value) {
      ElMessage.warning('请选择阅读原文链接')
      return
    }
    const result = await publishRun(props.runId, {
      readSourcePresetId: readSourcePresetId.value,
    })
    ElMessage.success(`已写入草稿箱：${result.draftMediaId}`)
    emit('refreshed')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '发布失败')
  } finally {
    publishing.value = false
  }
}

watch(
  () => props.artifacts,
  (value) => {
    if (props.regeneratingFrom && isStepAtOrAfter(props.step, props.regeneratingFrom)) {
      return
    }
    syncFormsFromArtifacts(value)
  },
  { immediate: true },
)

watch(
  () => [props.step, props.stepDetail?.output, props.stepDetail?.status] as const,
  () => {
    if (props.step !== 'layout' || props.stepDetail?.status !== 'succeeded') {
      return
    }
    const fromStep = stepOutputField(props.stepDetail?.output, 'bodyHtml')
    if (fromStep && !draftForm.bodyHtml.trim()) {
      draftForm.bodyHtml = fromStep
    }
  },
)
</script>

<template>
  <section
    v-loading="loading"
    class="step-panel"
  >
    <header class="step-panel__head">
      <div>
        <h2>{{ stepTitle }}</h2>
        <p class="step-panel__desc">
          查看本节点状态与产物，可编辑保存，或基于上游内容重新生成。
        </p>
      </div>
      <div class="step-panel__actions">
        <el-button
          v-if="step !== 'publish'"
          :loading="regenerating"
          :disabled="!canRegenerate"
          @click="handleRegenerate"
        >
          重新生成此节点
        </el-button>
        <el-button
          v-if="step === 'writer' || step === 'layout' || step === 'cover'"
          type="primary"
          :loading="saving"
          :disabled="!isDraftDirty"
          @click="handleSaveDraft"
        >
          保存成稿
        </el-button>
        <el-button
          v-if="step === 'enrich'"
          type="primary"
          :loading="saving"
          :disabled="!isDigestDirty"
          @click="handleSaveDigest"
        >
          保存 Digest
        </el-button>
        <el-button
          v-if="step === 'publish'"
          type="success"
          :loading="publishing"
          :disabled="!draftForm.bodyHtml || stepDetail?.status === 'running'"
          @click="handlePublish"
        >
          发布到草稿箱
        </el-button>
      </div>
    </header>

    <div
      v-if="stepDetail"
      class="step-panel__meta"
    >
      <el-tag
        size="small"
        :type="stepDetail.status === 'succeeded' ? 'success' : stepDetail.status === 'failed' ? 'danger' : stepDetail.status === 'running' ? 'warning' : 'info'"
      >
        {{ stepStatusLabel }}
      </el-tag>
      <span v-if="stepDetail.durationMs != null">耗时 {{ stepDetail.durationMs }}ms</span>
      <span v-if="stepDetail.startedAt">开始 {{ formatDateTime(stepDetail.startedAt) }}</span>
      <span v-if="stepDetail.finishedAt">完成 {{ formatDateTime(stepDetail.finishedAt) }}</span>
    </div>

    <el-alert
      v-if="isRegenerating"
      type="warning"
      show-icon
      :closable="false"
      title="正在重新生成"
      description="本节点及下游内容已清空，Worker 正在级联执行，请稍候。"
      class="step-panel__alert"
    />

    <el-alert
      v-else-if="stepDetail?.errorMessage"
      type="error"
      show-icon
      :closable="false"
      :title="stepDetail.errorMessage"
      class="step-panel__alert"
    />

    <!-- 采集：运营概览 -->
    <template v-if="step === 'collect'">
      <CollectStepPanel
        :step-detail="stepDetail"
        :is-regenerating="isRegenerating"
      />
    </template>

    <!-- 排序：Top 10 预览 -->
    <template v-else-if="step === 'rank'">
      <RankStepPanel
        :step-detail="stepDetail"
        :artifacts="artifacts"
        :is-regenerating="isRegenerating"
      />
    </template>

    <!-- 富化：Digest 编辑工作台 -->
    <template v-else-if="step === 'enrich'">
      <EnrichStepPanel
        v-model="digestItems"
        :step-detail="stepDetail"
        :artifacts="artifacts"
        :is-regenerating="isRegenerating"
      />
    </template>

    <!-- 选题 -->
    <template v-else-if="step === 'editor'">
      <EditorStepPanel
        :step-detail="stepDetail"
        :artifacts="artifacts"
        :is-regenerating="isRegenerating"
      />
    </template>

    <!-- 写作 -->
    <template v-else-if="step === 'writer'">
      <WriterStepPanel
        :draft="draftForm"
        :step-detail="stepDetail"
        :artifacts="artifacts"
        :is-regenerating="isRegenerating"
      />
    </template>

    <!-- 配图 -->
    <template v-else-if="step === 'illustrate'">
      <IllustrateStepPanel
        :run-id="runId"
        :step-detail="stepDetail"
        :is-regenerating="isRegenerating"
        @refreshed="emit('refreshed')"
      />
    </template>

    <!-- 排版 -->
    <template v-else-if="step === 'layout'">
      <LayoutStepPanel
        :run-id="runId"
        :step-detail="stepDetail"
        :artifacts="artifacts"
        v-model:layout-body-html="layoutBodyHtml"
        :layout-template-id="layoutTemplateId"
        :layout-template-name="layoutTemplateName"
        :is-regenerating="isRegenerating"
        :can-regenerate="canRegenerate"
        @refreshed="emit('refreshed')"
        @run-updated="emit('refreshed')"
        @request-regenerate="handleRegenerate"
      />
    </template>

    <!-- 封面 -->
    <template v-else-if="step === 'cover'">
      <el-empty
        v-if="isRegenerating"
        description="正在重新生成封面…"
      />
      <el-form
        v-else
        label-position="top"
        class="step-panel__form"
      >
        <el-form-item label="封面 URL">
          <el-input
            v-model="draftForm.coverUrl"
            placeholder="AI 生成或 RSS 配图 URL"
          />
        </el-form-item>
      </el-form>
      <div
        v-if="!isRegenerating && draftForm.coverUrl"
        class="step-panel__cover-preview"
      >
        <img
          :src="draftForm.coverUrl"
          alt="封面预览"
          loading="lazy"
        >
      </div>
      <pre class="step-panel__json">{{ formattedOutput || '暂无 Cover 输出' }}</pre>
    </template>

    <!-- 质检 -->
    <template v-else-if="step === 'review'">
      <el-empty
        v-if="isRegenerating"
        description="正在重新生成质检结果…"
      />
      <ReviewScorePanel
        v-else
        :review="reviewSource"
      />
      <details
        v-if="formattedOutput"
        class="step-panel__raw"
      >
        <summary>原始 JSON</summary>
        <pre class="step-panel__json">{{ formattedOutput }}</pre>
      </details>
    </template>

    <!-- 发布 -->
    <template v-else-if="step === 'publish'">
      <ReadSourcePresetSelect
        v-model="readSourcePresetId"
        class="step-panel__read-source"
      />
      <el-descriptions
        :column="1"
        border
      >
        <el-descriptions-item label="草稿 media_id">
          {{ artifacts?.draftMediaId ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="发布模式">
          {{ artifacts?.publishMode ?? '—' }}
        </el-descriptions-item>
      </el-descriptions>
      <pre
        v-if="formattedOutput"
        class="step-panel__json"
      >{{ formattedOutput }}</pre>
      <el-empty
        v-else-if="stepDetail?.status === 'pending'"
        description="完成封面生成后，在此手动发布到微信草稿箱"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.step-panel {
  min-height: 400px;
}

.step-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.step-panel__desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.step-panel__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.step-panel__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.step-panel__alert {
  margin-bottom: 16px;
}

.step-panel__json {
  margin: 0;
  padding: 14px;
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  max-height: 480px;
}

.step-panel__form {
  margin-bottom: 16px;
  max-width: 640px;
}

.step-panel__desc-block {
  margin-bottom: 16px;
}

.step-panel__raw {
  margin-top: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.step-panel__cover-preview {
  margin-bottom: 16px;
  max-width: 480px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);

  img {
    display: block;
    width: 100%;
    aspect-ratio: 2.35 / 1;
    object-fit: cover;
  }
}

@media (max-width: 768px) {
  .step-panel__head {
    flex-direction: column;
  }

  .step-panel__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
