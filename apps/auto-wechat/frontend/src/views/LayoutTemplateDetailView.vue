<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { deleteLayoutTemplate, getLayoutTemplate, setDefaultLayoutTemplate } from '@/api/layoutTemplates'
import PhonePreviewFrame from '@/components/layout/PhonePreviewFrame.vue'
import WeChatScanPreviewDialog from '@/components/layout/WeChatScanPreviewDialog.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { formatDateTime } from '@/utils/format'
import { articleTypeLabel, itemCountLabel } from '@/utils/layoutOutput'

import type { LayoutTemplateDetail } from '@/types/layoutTemplate'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const loading = ref(false)
const template = ref<LayoutTemplateDetail | null>(null)
const showSource = ref(false)
const wechatPreviewVisible = ref(false)

const sourceRunLink = computed(() => {
  if (!template.value?.sourceRunId) {
    return null
  }
  return {
    name: ROUTE_NAMES.RUN_DETAIL,
    params: { id: template.value.sourceRunId },
    query: { step: 'layout' },
  }
})

async function fetchDetail(): Promise<void> {
  loading.value = true
  try {
    template.value = await getLayoutTemplate(props.id)
  } catch {
    template.value = null
  } finally {
    loading.value = false
  }
}

async function handleDelete(): Promise<void> {
  if (!template.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除「${template.value.name}」？`,
      '删除模板',
      { type: 'warning' },
    )
    await deleteLayoutTemplate(template.value.id)
    ElMessage.success('已删除')
    void router.push({ name: ROUTE_NAMES.LAYOUT_TEMPLATES })
  } catch {
    // cancelled
  }
}

async function handleSetDefault(): Promise<void> {
  if (!template.value || template.value.isDefault) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `将「${template.value.name}」设为全局默认排版模板？`,
      '设为默认',
      { type: 'info' },
    )
    template.value = await setDefaultLayoutTemplate(template.value.id)
    ElMessage.success('已设为全局默认')
  } catch {
    // cancelled or failed
  }
}

function goBack(): void {
  void router.push({ name: ROUTE_NAMES.LAYOUT_TEMPLATES })
}

onMounted(() => {
  void fetchDetail()
})
</script>

<template>
  <section
    v-loading="loading"
    class="template-detail"
  >
    <el-button
      link
      type="primary"
      class="template-detail__back"
      @click="goBack"
    >
      ← 返回模板库
    </el-button>

    <el-empty
      v-if="!loading && !template"
      description="模板不存在或已删除"
    />

    <div
      v-else-if="template"
      class="template-detail__layout"
    >
      <aside class="template-detail__meta">
        <h1 class="template-detail__title">
          {{ template.name }}
        </h1>
        <p
          v-if="template.description"
          class="template-detail__desc"
        >
          {{ template.description }}
        </p>

        <div class="template-detail__badges">
          <el-tag
            v-if="template.isDefault"
            type="warning"
            effect="dark"
          >
            全局默认
          </el-tag>
          <el-tag
            v-if="template.isFeatured"
            type="warning"
            effect="dark"
          >
            精选
          </el-tag>
          <el-tag
            v-if="template.hasSvg"
            type="primary"
            effect="plain"
          >
            SVG 交互
          </el-tag>
          <el-tag effect="plain">
            {{ articleTypeLabel(template.articleType) }}
          </el-tag>
        </div>

        <dl class="template-detail__facts">
          <div>
            <dt>适用条数</dt>
            <dd>{{ itemCountLabel(template.itemCountMin, template.itemCountMax) }}</dd>
          </div>
          <div>
            <dt>质量分</dt>
            <dd>{{ template.qualityScore }}</dd>
          </div>
          <div>
            <dt>使用次数</dt>
            <dd>{{ template.usageCount }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(template.updatedAt) }}</dd>
          </div>
        </dl>

        <div
          v-if="template.tags?.length"
          class="template-detail__tags"
        >
          <span class="template-detail__tags-label">标签</span>
          <el-tag
            v-for="tag in template.tags"
            :key="tag"
            size="small"
            round
          >
            {{ tag }}
          </el-tag>
        </div>

        <div
          v-if="sourceRunLink"
          class="template-detail__source"
        >
          <span class="template-detail__tags-label">来源 Run</span>
          <RouterLink :to="sourceRunLink">
            {{ template.sourceRunId }}
          </RouterLink>
        </div>

        <div class="template-detail__actions">
          <el-button
            v-if="!template.isDefault"
            type="warning"
            plain
            @click="handleSetDefault"
          >
            设为全局默认
          </el-button>
          <el-button
            type="primary"
            @click="wechatPreviewVisible = true"
          >
            微信扫码预览
          </el-button>
          <el-button
            type="danger"
            plain
            @click="handleDelete"
          >
            删除模板
          </el-button>
        </div>

        <details
          class="template-detail__source-code"
          :open="showSource"
        >
          <summary @click.prevent="showSource = !showSource">
            高级 · 查看 HTML 源码
          </summary>
          <pre class="template-detail__pre">{{ template.bodyHtml }}</pre>
        </details>
      </aside>

      <main class="template-detail__preview">
        <PhonePreviewFrame
          :html="template.bodyHtml"
          :title="template.name"
          size="large"
        />
      </main>
    </div>

    <WeChatScanPreviewDialog
      v-if="template"
      v-model:visible="wechatPreviewVisible"
      :payload="{ layoutTemplateId: template.id, title: template.name }"
    />
  </section>
</template>

<style scoped lang="scss">
.template-detail__back {
  margin-bottom: 12px;
  padding-left: 0;
}

.template-detail__layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.template-detail__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.template-detail__desc {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.template-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.template-detail__facts {
  margin: 0 0 18px;
  display: grid;
  gap: 10px;

  div {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 8px;
    font-size: 13px;
  }

  dt {
    margin: 0;
    color: var(--el-text-color-secondary);
  }

  dd {
    margin: 0;
    font-weight: 500;
  }
}

.template-detail__tags,
.template-detail__source {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.template-detail__tags-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  width: 100%;
}

.template-detail__actions {
  margin-bottom: 16px;
}

.template-detail__source-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
    margin-bottom: 8px;
  }
}

.template-detail__pre {
  margin: 0;
  padding: 12px;
  max-height: 280px;
  overflow: auto;
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.template-detail__preview {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 140px);
  padding: 24px 20px 32px;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  border: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 900px) {
  .template-detail__layout {
    grid-template-columns: 1fr;
  }
}
</style>
