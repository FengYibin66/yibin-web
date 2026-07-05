<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  getRunArtifacts,
  publishRun,
  updateRunDigest,
  updateRunDraft,
} from '@/api/artifacts'
import DigestItemCard from '@/components/editor/DigestItemCard.vue'
import ReviewScorePanel from '@/components/run/ReviewScorePanel.vue'
import SplitCodePreview from '@/components/SplitCodePreview.vue'
import { parseReview } from '@/utils/reviewScore'
import ReadSourcePresetSelect from '@/components/ReadSourcePresetSelect.vue'
import RunStatusTag from '@/components/RunStatusTag.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import type { RunStatus } from '@/constants/pipeline'

import type { ContentDraftArtifact, RankedItem, RunArtifacts } from '@/types/artifacts'

type EditorSection = 'meta' | 'markdown' | 'html' | 'digest' | 'debug'

const props = defineProps<{
  id: string
}>()

const SECTIONS: { id: EditorSection; label: string; hint?: string }[] = [
  { id: 'meta', label: '发布元信息', hint: '标题 / 导语 / 封面' },
  { id: 'markdown', label: 'Markdown 正文', hint: 'Writer 输出，可改稿' },
  { id: 'html', label: '微信 HTML', hint: '发布以此为准' },
  { id: 'digest', label: 'Top10 素材', hint: 'Rank 结果' },
  { id: 'debug', label: '诊断信息', hint: 'Agent / 步骤' },
]

const router = useRouter()
const loading = ref(false)
const savingDraft = ref(false)
const savingDigest = ref(false)
const publishing = ref(false)
const error = ref<string | null>(null)
const artifacts = ref<RunArtifacts | null>(null)
const activeSection = ref<EditorSection>('meta')
const debugExpanded = ref<string[]>([])

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

const digestItems = ref<RankedItem[]>([])
const digestSnapshot = ref('')
const readSourcePresetId = ref('')
const readSourcePresetSnapshot = ref('')

const reviewRecord = computed(() => {
  const review = artifacts.value?.contentDraft?.review
  if (!review || typeof review !== 'object') {
    return null
  }
  return review as Record<string, unknown>
})

const parsedReview = computed(() => parseReview(reviewRecord.value))

const showReviewBanner = computed(() => {
  const parsed = parsedReview.value
  if (!parsed) {
    return false
  }
  if (parsed.legacy) {
    return reviewRecord.value?.approved === false
  }
  return parsed.overallScore < 70
    || parsed.dimensions.some((dim) => dim.score < 55)
})

const hasDraftContent = computed(() => {
  return Boolean(draftForm.bodyHtml.trim() || draftForm.bodyMarkdown.trim())
})

const canPublish = computed(() => {
  return Boolean(draftForm.bodyHtml.trim()) && artifacts.value?.runStatus !== 'running'
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

const isDigestDirty = computed(() => {
  return JSON.stringify(digestItems.value) !== digestSnapshot.value
})

const hasUnsavedChanges = computed(() => isDraftDirty.value || isDigestDirty.value)

const publishBlockReason = computed(() => {
  if (artifacts.value?.runStatus === 'running') {
    return 'Pipeline 仍在运行，请等待结束后再发布'
  }
  if (!draftForm.bodyHtml.trim()) {
    return '微信 HTML 为空，Layout 未完成或需手动填写'
  }
  return ''
})

const shortRunId = computed(() => {
  const runId = artifacts.value?.runId ?? props.id
  return runId.length > 12 ? `${runId.slice(0, 8)}…` : runId
})

async function fetchArtifacts(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await getRunArtifacts(props.id)
    artifacts.value = data
    digestItems.value = data.digest?.items ? [...data.digest.items] : []
    digestSnapshot.value = JSON.stringify(digestItems.value)
    syncDraftForm(data.contentDraft)
    captureDraftSnapshot()

    if (!hasDraftContent.value && digestItems.value.length > 0) {
      activeSection.value = 'digest'
    } else if (showReviewBanner.value) {
      activeSection.value = 'html'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function syncDraftForm(draft?: ContentDraftArtifact): void {
  draftForm.title = draft?.title ?? ''
  draftForm.summary = draft?.summary ?? ''
  draftForm.bodyMarkdown = draft?.bodyMarkdown ?? ''
  draftForm.bodyHtml = draft?.bodyHtml ?? ''
  draftForm.coverUrl = draft?.coverUrl ?? ''
  readSourcePresetId.value = draft?.readSourcePresetId ?? ''
}

function captureDraftSnapshot(): void {
  draftSnapshot.title = draftForm.title
  draftSnapshot.summary = draftForm.summary
  draftSnapshot.bodyMarkdown = draftForm.bodyMarkdown
  draftSnapshot.bodyHtml = draftForm.bodyHtml
  draftSnapshot.coverUrl = draftForm.coverUrl
  readSourcePresetSnapshot.value = readSourcePresetId.value
}

async function handleSaveDraft(): Promise<boolean> {
  savingDraft.value = true
  try {
    const updated = await updateRunDraft(props.id, {
      ...draftForm,
      readSourcePresetId: readSourcePresetId.value || undefined,
    })
    if (artifacts.value) {
      artifacts.value.contentDraft = updated
      artifacts.value.previewHtml = updated.bodyHtml
    }
    captureDraftSnapshot()
    ElMessage.success('成稿已保存')
    return true
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
    return false
  } finally {
    savingDraft.value = false
  }
}

async function handleSaveDigest(): Promise<boolean> {
  savingDigest.value = true
  try {
    const updated = await updateRunDigest(props.id, { items: digestItems.value })
    if (artifacts.value) {
      artifacts.value.digest = updated
    }
    digestSnapshot.value = JSON.stringify(digestItems.value)
    ElMessage.success('Digest 已保存')
    return true
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
    return false
  } finally {
    savingDigest.value = false
  }
}

async function handlePublish(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将把当前成稿写入微信公众号草稿箱。发布前会自动保存未保存的修改。',
      '确认发布',
      { confirmButtonText: '发布', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  publishing.value = true
  try {
    if (isDraftDirty.value) {
      const saved = await handleSaveDraft()
      if (!saved) {
        return
      }
    }
    if (!readSourcePresetId.value) {
      ElMessage.warning('请选择阅读原文链接')
      return
    }
    const result = await publishRun(props.id, {
      readSourcePresetId: readSourcePresetId.value,
    })
    if (artifacts.value) {
      artifacts.value.draftMediaId = result.draftMediaId
      artifacts.value.publishResult = result
      artifacts.value.runStatus = 'succeeded'
    }
    ElMessage.success(`已写入微信草稿箱：${result.draftMediaId}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '发布失败')
  } finally {
    publishing.value = false
  }
}

function formatJson(value: unknown): string {
  if (value == null) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function scrollToSection(section: EditorSection): void {
  activeSection.value = section
  const el = document.getElementById(`section-${section}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleBack(): Promise<void> {
  if (hasUnsavedChanges.value) {
    try {
      await ElMessageBox.confirm('有未保存的修改，确定离开？', '未保存的修改', {
        confirmButtonText: '离开',
        cancelButtonText: '继续编辑',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  void router.push({ name: ROUTE_NAMES.RUN_DETAIL, params: { id: props.id } })
}

function handlePreview(): void {
  void router.push({ name: ROUTE_NAMES.DRAFT_PREVIEW, params: { id: props.id } })
}

watch(activeSection, (section) => {
  debugExpanded.value = section === 'debug' && artifacts.value?.steps.length
    ? [artifacts.value.steps[0].step]
    : []
})

onMounted(() => {
  void fetchArtifacts()
})
</script>

<template>
  <div
    v-loading="loading"
    class="run-editor"
  >
    <el-result
      v-if="error"
      icon="error"
      title="加载失败"
      :sub-title="error"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="fetchArtifacts"
        >
          重试
        </el-button>
      </template>
    </el-result>

    <template v-else-if="artifacts">
      <!-- 固定顶栏 -->
      <header class="run-editor__toolbar">
        <div class="run-editor__toolbar-left">
          <el-button
            text
            @click="handleBack"
          >
            ← Run 详情
          </el-button>
          <div class="run-editor__toolbar-divider" />
          <div class="run-editor__toolbar-title">
            <span class="run-editor__toolbar-label">成稿工作台</span>
            <span
              v-if="draftForm.title"
              class="run-editor__toolbar-draft-title"
            >
              {{ draftForm.title }}
            </span>
          </div>
          <el-tag
            v-if="hasUnsavedChanges"
            type="warning"
            effect="plain"
            size="small"
          >
            未保存
          </el-tag>
        </div>
        <div class="run-editor__toolbar-actions">
          <el-button @click="handlePreview">
            全屏预览
          </el-button>
          <el-button
            :loading="savingDraft"
            :disabled="!isDraftDirty"
            @click="handleSaveDraft"
          >
            保存成稿
          </el-button>
          <el-tooltip
            :content="publishBlockReason"
            :disabled="canPublish"
            placement="bottom"
          >
            <el-button
              type="success"
              :loading="publishing"
              :disabled="!canPublish"
              @click="handlePublish"
            >
              发布到草稿箱
            </el-button>
          </el-tooltip>
        </div>
      </header>

      <!-- 状态条 -->
      <div class="run-editor__status-bar">
        <RunStatusTag :status="artifacts.runStatus as RunStatus" />
        <span class="run-editor__status-item">Run {{ shortRunId }}</span>
        <span
          v-if="digestItems.length"
          class="run-editor__status-item"
        >
          Digest {{ digestItems.length }} 条
        </span>
        <el-tag
          v-if="artifacts.draftMediaId"
          type="success"
          size="small"
          effect="plain"
        >
          已发布 · {{ artifacts.draftMediaId }}
        </el-tag>
        <el-button
          text
          size="small"
          class="run-editor__refresh"
          @click="fetchArtifacts"
        >
          刷新
        </el-button>
      </div>

      <section
        v-if="reviewRecord && showReviewBanner"
        class="run-editor__review-panel"
      >
        <ReviewScorePanel
          :review="reviewRecord"
          compact
        />
        <el-button
          link
          type="primary"
          @click="scrollToSection('html')"
        >
          跳转到微信 HTML →
        </el-button>
      </section>

      <!-- 空态 -->
      <el-empty
        v-if="!hasDraftContent && !digestItems.length"
        description="暂无中间产物，请等待 Pipeline 完成"
      />

      <!-- 主布局 -->
      <div
        v-else
        class="run-editor__layout"
      >
        <nav class="run-editor__nav">
          <p class="run-editor__nav-title">
            工作流程
          </p>
          <button
            v-for="item in SECTIONS"
            :key="item.id"
            type="button"
            class="run-editor__nav-item"
            :class="{ 'run-editor__nav-item--active': activeSection === item.id }"
            @click="scrollToSection(item.id)"
          >
            <span class="run-editor__nav-label">{{ item.label }}</span>
            <span class="run-editor__nav-hint">{{ item.hint }}</span>
          </button>
        </nav>

        <main class="run-editor__main">
          <!-- 元信息 -->
          <section
            id="section-meta"
            class="run-editor__section"
          >
            <header class="run-editor__section-head">
              <span class="run-editor__section-icon">1</span>
              <div>
                <h2>发布元信息</h2>
                <p>写入微信草稿箱时使用；标题建议 ≤64 字，导语 ≤120 字。</p>
              </div>
            </header>
            <div class="run-editor__meta-grid">
              <el-form
                label-position="top"
                class="run-editor__meta-form"
              >
                <el-form-item label="文章标题">
                  <el-input
                    v-model="draftForm.title"
                    maxlength="64"
                    show-word-limit
                    placeholder="公众号文章标题"
                  />
                </el-form-item>
                <el-form-item label="导语 / 摘要">
                  <el-input
                    v-model="draftForm.summary"
                    type="textarea"
                    :rows="3"
                    maxlength="120"
                    show-word-limit
                    placeholder="读者在列表页看到的摘要"
                  />
                </el-form-item>
                <el-form-item label="封面图 URL">
                  <el-input
                    v-model="draftForm.coverUrl"
                    placeholder="https://..."
                  />
                </el-form-item>
                <el-form-item>
                  <ReadSourcePresetSelect v-model="readSourcePresetId" />
                </el-form-item>
              </el-form>
              <div
                v-if="draftForm.coverUrl"
                class="run-editor__cover-preview"
              >
                <span class="run-editor__cover-label">封面预览</span>
                <img
                  :src="draftForm.coverUrl"
                  alt="封面预览"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
              </div>
            </div>
          </section>

          <!-- Markdown -->
          <section
            id="section-markdown"
            class="run-editor__section run-editor__section--flat"
          >
            <SplitCodePreview
              v-model="draftForm.bodyMarkdown"
              mode="markdown"
              title="Markdown 正文"
              subtitle="Writer Agent 输出。左侧改源码，右侧即时预览；不会自动同步到微信 HTML。"
              placeholder="Writer 输出的 Markdown 正文"
            />
          </section>

          <!-- HTML -->
          <section
            id="section-html"
            class="run-editor__section run-editor__section--flat"
          >
            <SplitCodePreview
              v-model="draftForm.bodyHtml"
              mode="html"
              title="微信 HTML"
              subtitle="Layout Agent 输出的公众号兼容 HTML。发布草稿箱以本段内容为准。"
              badge="发布用此内容"
              placeholder="Layout 输出的微信兼容 HTML"
            />
          </section>

          <!-- Digest -->
          <section
            id="section-digest"
            class="run-editor__section"
          >
            <header class="run-editor__section-head">
              <span class="run-editor__section-icon">4</span>
              <div>
                <h2>Top10 素材</h2>
                <p>Rank 阶段选出的资讯条目，可微调后保存，供后续 Run 参考。</p>
              </div>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="savingDigest"
                :disabled="!isDigestDirty"
                class="run-editor__section-action"
                @click="handleSaveDigest"
              >
                保存 Digest
              </el-button>
            </header>
            <div class="run-editor__digest-list">
              <DigestItemCard
                v-for="(item, index) in digestItems"
                :key="item.url || `${index}-${item.title}`"
                :index="index + 1"
                :item="item"
              />
            </div>
            <el-empty
              v-if="!digestItems.length"
              description="暂无 Digest 数据"
            />
          </section>

          <!-- 诊断 -->
          <section
            id="section-debug"
            class="run-editor__section run-editor__section--muted"
          >
            <header class="run-editor__section-head">
              <span class="run-editor__section-icon">5</span>
              <div>
                <h2>诊断信息</h2>
                <p>Editor 选题、Review 结果与各 Pipeline 步骤快照，只读。</p>
              </div>
            </header>

            <el-collapse v-model="debugExpanded">
              <el-collapse-item
                title="Editor 选题"
                name="editor"
              >
                <pre class="run-editor__json">{{ formatJson(artifacts.contentDraft?.editor) }}</pre>
              </el-collapse-item>
              <el-collapse-item
                title="Review 结果"
                name="review"
              >
                <pre class="run-editor__json">{{ formatJson(artifacts.contentDraft?.review) }}</pre>
              </el-collapse-item>
              <el-collapse-item
                v-for="step in artifacts.steps"
                :key="step.step"
                :title="`${step.step} · ${step.status}`"
                :name="step.step"
              >
                <p
                  v-if="step.errorMessage"
                  class="run-editor__step-error"
                >
                  错误：{{ step.errorMessage }}
                </p>
                <pre class="run-editor__json">{{ formatJson(step.output) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </section>
        </main>
      </div>
    </template>

    <el-empty
      v-else-if="!loading"
      description="暂无中间产物"
    />
  </div>
</template>

<style scoped lang="scss">
.run-editor {
  --editor-toolbar-height: 56px;
  margin: -24px;
  min-height: calc(100vh - 56px);
  background: var(--el-fill-color-lighter);
}

.run-editor__toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: var(--editor-toolbar-height);
  padding: 0 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 4px rgb(0 0 0 / 4%);
}

.run-editor__toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.run-editor__toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--el-border-color);
  margin: 0 4px;
}

.run-editor__toolbar-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.run-editor__toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.run-editor__toolbar-draft-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.run-editor__toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.run-editor__status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.run-editor__status-item {
  color: var(--el-text-color-secondary);
}

.run-editor__refresh {
  margin-left: auto;
}

.run-editor__review-panel {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.run-editor__review-banner {
  display: flex;
  gap: 12px;
  margin: 16px 20px 0;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}

.run-editor__review-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-color-warning);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  margin-top: 2px;
}

.run-editor__review-body {
  flex: 1;
  font-size: 14px;
  line-height: 1.6;

  p {
    margin: 6px 0 0;
    color: var(--el-text-color-regular);
  }
}

.run-editor__review-issues {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--el-text-color-regular);
}

.run-editor__layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 0;
  align-items: start;
  padding: 16px 20px 40px;
  max-width: 1440px;
  margin: 0 auto;
}

.run-editor__nav {
  position: sticky;
  top: calc(var(--editor-toolbar-height) + 12px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.run-editor__nav-title {
  margin: 0 0 8px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
}

.run-editor__nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &--active {
    background: var(--el-color-primary-light-9);

    .run-editor__nav-label {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }
}

.run-editor__nav-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.run-editor__nav-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.run-editor__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding-left: 16px;
}

.run-editor__section {
  scroll-margin-top: calc(var(--editor-toolbar-height) + 16px);
  padding: 20px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.run-editor__section--muted {
  background: var(--el-fill-color-blank);
}

.run-editor__section--flat {
  padding: 0;
  border: none;
  background: transparent;
}

.run-editor__section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }
}

.run-editor__section-action {
  margin-left: auto;
  flex-shrink: 0;
}

.run-editor__section-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.run-editor__meta-grid {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 24px;
  align-items: start;
}

.run-editor__meta-form {
  min-width: 0;
}

.run-editor__cover-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;

  img {
    width: 100%;
    aspect-ratio: 2.35 / 1;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
  }
}

.run-editor__cover-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.run-editor__digest-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.run-editor__json {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  max-height: 360px;
}

.run-editor__step-error {
  margin: 0 0 8px;
  color: var(--el-color-danger);
  font-size: 13px;
}

@media (max-width: 960px) {
  .run-editor__layout {
    grid-template-columns: 1fr;
  }

  .run-editor__nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    padding: 8px;
  }

  .run-editor__nav-title {
    display: none;
  }

  .run-editor__nav-item {
    flex-shrink: 0;
    min-width: 120px;
  }

  .run-editor__nav-hint {
    display: none;
  }

  .run-editor__main {
    padding-left: 0;
  }

  .run-editor__meta-grid {
    grid-template-columns: 1fr;
  }

  .run-editor__toolbar {
    flex-wrap: wrap;
    height: auto;
    padding: 12px 16px;
  }

  .run-editor__toolbar-draft-title {
    max-width: 160px;
  }
}
</style>
