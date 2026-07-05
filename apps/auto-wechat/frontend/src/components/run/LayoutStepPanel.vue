<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { listLayoutTemplates, saveRunAsLayoutTemplate } from '@/api/layoutTemplates'
import { updateRunLayoutTemplate } from '@/api/pipeline'

import type { LayoutTemplateSummary } from '@/types/layoutTemplate'
import PhonePreviewFrame from '@/components/layout/PhonePreviewFrame.vue'
import SplitCodePreview from '@/components/SplitCodePreview.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { LAYOUT_TEMPLATE_TAG_SUGGESTIONS } from '@/constants/layoutTemplate'
import { parseLayoutStepOutput } from '@/utils/layoutOutput'

import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'

const props = defineProps<{
  runId: string
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  layoutBodyHtml: string
  layoutTemplateId?: string | null
  layoutTemplateName?: string | null
  isRegenerating?: boolean
  canRegenerate?: boolean
}>()

const emit = defineEmits<{
  'update:layoutBodyHtml': [value: string]
  refreshed: []
  runUpdated: []
  requestRegenerate: []
}>()

const router = useRouter()
const saveDialogVisible = ref(false)
const savingTemplate = ref(false)
const templatesLoading = ref(false)
const templateUpdating = ref(false)
const templateLibrary = ref<LayoutTemplateSummary[]>([])
const selectedTemplateId = ref<string>('')
const saveForm = ref({
  name: '',
  description: '',
  tags: [] as string[],
})

const layoutView = computed(() => parseLayoutStepOutput(props.stepDetail?.output))

const bodyHtmlModel = computed({
  get: () => props.layoutBodyHtml,
  set: (value: string) => emit('update:layoutBodyHtml', value),
})

const renderEngineLabel = computed(() => {
  const engine = layoutView.value?.renderEngine
  if (engine === 'template_fewshot/v1') {
    return '模板 Few-shot 仿写'
  }
  if (engine === 'wechatarticle/v1') {
    return 'Blocks 渲染'
  }
  if (engine === 'legacy_llm_html') {
    return 'Legacy HTML'
  }
  return engine || '—'
})

const showEditor = ref(false)

const selectedTemplateLabel = computed(() => {
  if (props.layoutTemplateName) {
    return props.layoutTemplateName
  }
  const found = templateLibrary.value.find((item) => item.id === selectedTemplateId.value)
  return found?.name ?? '未指定（将自动匹配）'
})

const globalDefaultTemplate = computed(() => templateLibrary.value.find((item) => item.isDefault))

const templateChanged = computed(() => {
  const current = props.layoutTemplateId ?? ''
  return selectedTemplateId.value !== current
})

watch(
  () => props.layoutTemplateId,
  (value) => {
    selectedTemplateId.value = value ?? ''
  },
  { immediate: true },
)

async function loadTemplateLibrary(): Promise<void> {
  templatesLoading.value = true
  try {
    templateLibrary.value = await listLayoutTemplates()
  } finally {
    templatesLoading.value = false
  }
}

onMounted(() => {
  void loadTemplateLibrary()
})

async function applyTemplateUpdate(payload: Parameters<typeof updateRunLayoutTemplate>[1]): Promise<void> {
  templateUpdating.value = true
  try {
    await updateRunLayoutTemplate(props.runId, payload)
    emit('runUpdated')
  } finally {
    templateUpdating.value = false
  }
}

async function handleApplyAndRegenerate(): Promise<void> {
  if (!selectedTemplateId.value) {
    ElMessage.warning('请先选择排版模板')
    return
  }
  if (templateChanged.value) {
    await applyTemplateUpdate({ layoutTemplateId: selectedTemplateId.value })
  }
  emit('requestRegenerate')
}

async function handleResetToGlobalDefault(): Promise<void> {
  if (!globalDefaultTemplate.value) {
    ElMessage.warning('模板库尚未设置全局默认')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将任务排版模板恢复为全局默认「${globalDefaultTemplate.value.name}」，并重新生成排版。`,
      '恢复全局默认',
      { type: 'info', confirmButtonText: '恢复并重新生成', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await applyTemplateUpdate({ useGlobalDefault: true })
  selectedTemplateId.value = globalDefaultTemplate.value.id
  emit('requestRegenerate')
}

async function handleUseMatcherFallback(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '清除任务指定模板后，排版将回退到 Top3 Matcher 自动匹配。是否继续并重新生成？',
      '回退自动匹配',
      { type: 'warning', confirmButtonText: '清除并重新生成', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await applyTemplateUpdate({ clearTemplate: true })
  selectedTemplateId.value = ''
  emit('requestRegenerate')
}

function openSaveDialog(): void {
  const title = props.artifacts?.contentDraft?.title
  saveForm.value = {
    name: title ? `${title} · 排版模板` : `Run 模板 ${new Date().toLocaleDateString('zh-CN')}`,
    description: layoutView.value?.layoutNotes ?? '',
    tags: ['日报合集'],
  }
  saveDialogVisible.value = true
}

async function handleSaveAsTemplate(): Promise<void> {
  if (!saveForm.value.name.trim()) {
    return
  }
  savingTemplate.value = true
  try {
    const created = await saveRunAsLayoutTemplate(props.runId, {
      name: saveForm.value.name.trim(),
      description: saveForm.value.description.trim() || undefined,
      tags: saveForm.value.tags,
    })
    saveDialogVisible.value = false
    ElMessage.success('已保存到模板库')
    emit('refreshed')
    void router.push({
      name: ROUTE_NAMES.LAYOUT_TEMPLATE_DETAIL,
      params: { id: created.id },
    })
  } finally {
    savingTemplate.value = false
  }
}

function goTemplateLibrary(): void {
  void router.push({ name: ROUTE_NAMES.LAYOUT_TEMPLATES })
}

function goTemplateDetail(templateId: string): void {
  void router.push({
    name: ROUTE_NAMES.LAYOUT_TEMPLATE_DETAIL,
    params: { id: templateId },
  })
}
</script>

<template>
  <div class="layout-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在按任务模板生成排版 HTML…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，需先完成写作"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="正在从任务排版模板 few-shot 仿写微信 HTML…"
    />

    <template v-else-if="bodyHtmlModel || layoutView">
      <section class="layout-panel__template-picker">
        <div class="layout-panel__template-picker-head">
          <h3 class="layout-panel__section-title">
            任务排版模板
          </h3>
          <span class="layout-panel__template-current">
            当前：{{ selectedTemplateLabel }}
          </span>
        </div>
        <div class="layout-panel__template-controls">
          <el-select
            v-model="selectedTemplateId"
            filterable
            clearable
            placeholder="选择模板（留空则 Matcher 自动匹配）"
            :loading="templatesLoading"
            style="min-width: 260px; flex: 1"
          >
            <el-option
              v-for="item in templateLibrary"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              <span>{{ item.name }}</span>
              <el-tag
                v-if="item.isDefault"
                size="small"
                type="warning"
                effect="plain"
                style="margin-left: 8px"
              >
                全局默认
              </el-tag>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            plain
            :loading="templateUpdating"
            :disabled="!canRegenerate || !selectedTemplateId"
            @click="handleApplyAndRegenerate"
          >
            用此模板重新生成
          </el-button>
          <el-button
            :loading="templateUpdating"
            :disabled="!canRegenerate || !globalDefaultTemplate"
            @click="handleResetToGlobalDefault"
          >
            恢复为全局默认
          </el-button>
          <el-button
            link
            type="info"
            :disabled="!canRegenerate || !layoutTemplateId"
            @click="handleUseMatcherFallback"
          >
            回退 Matcher
          </el-button>
        </div>
        <p class="layout-panel__template-hint">
          新建 Run 时会复制全局默认模板；此处修改只影响本任务，不会改动模板库默认设置。
        </p>
      </section>

      <div class="layout-panel__toolbar">
        <div class="layout-panel__engine">
          <span class="layout-panel__engine-label">渲染引擎</span>
          <el-tag
            size="small"
            effect="plain"
          >
            {{ renderEngineLabel }}
          </el-tag>
          <el-button
            link
            type="primary"
            @click="goTemplateLibrary"
          >
            打开模板库
          </el-button>
        </div>
        <div class="layout-panel__toolbar-actions">
          <el-button
            size="small"
            @click="showEditor = !showEditor"
          >
            {{ showEditor ? '只看预览' : '编辑 HTML' }}
          </el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!bodyHtmlModel.trim()"
            @click="openSaveDialog"
          >
            存为模板
          </el-button>
        </div>
      </div>

      <section
        v-if="layoutView?.templateMatch.length"
        class="layout-panel__match"
      >
        <h3 class="layout-panel__section-title">
          本期模板匹配 Top3
        </h3>
        <div class="layout-panel__match-list">
          <div
            v-for="(entry, index) in layoutView.templateMatch"
            :key="entry.templateId"
            class="layout-panel__match-item"
            :class="{ 'layout-panel__match-item--primary': entry.templateId === layoutView.selectedTemplateId }"
          >
            <div class="layout-panel__match-rank">
              #{{ index + 1 }}
            </div>
            <div class="layout-panel__match-body">
              <div class="layout-panel__match-head">
                <el-tag
                  size="small"
                  :type="entry.templateId === layoutView.selectedTemplateId ? 'success' : 'info'"
                >
                  {{ entry.score }} 分
                </el-tag>
                <span
                  v-if="entry.templateId === layoutView.selectedTemplateId"
                  class="layout-panel__match-used"
                >主模板</span>
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="goTemplateDetail(entry.templateId)"
                >
                  在库中查看
                </el-button>
              </div>
              <p class="layout-panel__match-reason">
                {{ entry.reason || '—' }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <p
        v-if="layoutView?.layoutNotes"
        class="layout-panel__notes"
      >
        {{ layoutView.layoutNotes }}
      </p>

      <PhonePreviewFrame
        v-if="!showEditor && bodyHtmlModel.trim()"
        :html="bodyHtmlModel"
        title="本期排版预览"
      />

      <SplitCodePreview
        v-else-if="showEditor"
        v-model="bodyHtmlModel"
        mode="html"
        title="微信 HTML"
        subtitle="可编辑后保存成稿；发布用此内容"
        badge="发布用此内容"
        placeholder="Layout 输出的 HTML"
      />

      <el-empty
        v-else
        description="暂无 HTML 内容"
      />
    </template>

    <el-empty
      v-else
      description="排版尚未完成"
    />

    <el-dialog
      v-model="saveDialogVisible"
      title="存为排版模板"
      width="480px"
      destroy-on-close
    >
      <p class="layout-panel__dialog-hint">
        将本期成稿 HTML 沉淀到模板库，供后续 matcher 匹配与 few-shot 仿写。
      </p>
      <el-form label-position="top">
        <el-form-item
          label="模板名称"
          required
        >
          <el-input
            v-model="saveForm.name"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="saveForm.description"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="适用场景、板块结构、交互特点"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="saveForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in LAYOUT_TEMPLATE_TAG_SUGGESTIONS"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="savingTemplate"
          :disabled="!saveForm.name.trim()"
          @click="handleSaveAsTemplate"
        >
          保存到模板库
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.layout-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.layout-panel__template-picker {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.layout-panel__template-picker-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.layout-panel__template-current {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.layout-panel__template-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.layout-panel__template-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.layout-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.layout-panel__engine {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.layout-panel__engine-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.layout-panel__section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.layout-panel__match {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.layout-panel__match-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layout-panel__match-item {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--el-bg-color);

  &--primary {
    border: 1px solid var(--el-color-success-light-5);
    background: var(--el-color-success-light-9);
  }
}

.layout-panel__match-rank {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.layout-panel__match-body {
  flex: 1;
  min-width: 0;
}

.layout-panel__match-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.layout-panel__match-used {
  font-size: 12px;
  color: var(--el-color-success);
  font-weight: 600;
}

.layout-panel__match-reason {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.layout-panel__notes {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.layout-panel__dialog-hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
